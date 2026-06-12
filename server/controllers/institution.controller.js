// Returns a network graph of all institutions connected by shared persons, with optional filters
exports.getAllInstitutionNetwork = async (req, res) => {
    const { diocese, state, city, instType, instFunction, language, order } = req.query;
    const params = parseNetworkParams(req.query);
    if (params.error) {
        return res.status(400).json({ message: params.error });
    }
    const { startYear, endYear, limit } = params;

    const key = cacheKey('institution/network', req.query);
    const cached = networkCache.get(key);
    if (cached) return res.send(cached);

    // Build WHERE clauses for almanacRecord (not institution)
    // These filters must be applied to ar1 and ar2
    const arWhere = [];
    const replacements = {};
    if (diocese) {
        arWhere.push('ar1.diocese_reg LIKE :diocese');
        replacements.diocese = `%${diocese}%`;
    }
    if (state) {
        arWhere.push('ar1.stateOrig LIKE :state');
        replacements.state = `%${state}%`;
    }
    if (city) {
        arWhere.push('ar1.cityOrig LIKE :city');
        replacements.city = `%${city}%`;
    }
    if (instType) {
        arWhere.push('ar1.instType LIKE :instType');
        replacements.instType = `%${instType}%`;
    }
    if (instFunction) {
        arWhere.push('ar1.instFunction LIKE :instFunction');
        replacements.instFunction = `%${instFunction}%`;
    }
    if (language) {
        arWhere.push('ar1.language LIKE :language');
        replacements.language = `%${language}%`;
    }
    if (order) {
        // Restrict to records of institutions run by the given religious order
        arWhere.push('ar1.ID IN (SELECT oiar.almanacRecordID FROM orderInAlmanacRecords oiar WHERE oiar.`order` LIKE :order)');
        replacements.order = `%${order}%`;
    }
    // Year filter
    if (startYear != null && endYear != null) {
        arWhere.push('ar1.year BETWEEN :startYear AND :endYear');
        replacements.startYear = startYear;
        replacements.endYear = endYear;
    } else if (startYear != null) {
        arWhere.push('ar1.year >= :startYear');
        replacements.startYear = startYear;
    } else if (endYear != null) {
        arWhere.push('ar1.year <= :endYear');
        replacements.endYear = endYear;
    }
    // Compose WHERE clause
    const arWhereClause = arWhere.length ? 'WHERE ' + arWhere.join(' AND ') : '';
    try {
        // Get all institution IDs matching filters (from almanacRecord)
        const insts = await db.sequelize.query(
            `SELECT DISTINCT ar1.instID FROM almanacRecords ar1 ${arWhereClause}`,
            { replacements, type: db.Sequelize.QueryTypes.SELECT }
        );
        const instIDs = insts.map(i => i.instID);
        if (instIDs.length === 0) return res.send({ nodes: [], edges: [] });

        // Find all pairs of institutions that share at least one person in common in the time window
        // Only include institutions in instIDs
        // Apply the same filters to ar1 in the join
        const edgeWhere = [];
        if (instIDs.length) {
            edgeWhere.push('ar1.instID IN (:instIDs)');
            edgeWhere.push('ar2.instID IN (:instIDs)');
        }
        if (arWhere.length) {
            // Only apply filters to ar1 (not ar2)
            edgeWhere.push(...arWhere);
        }
        const edgeWhereClause = edgeWhere.length ? 'WHERE ' + edgeWhere.join(' AND ') : '';
        const edges = await db.sequelize.query(
            `SELECT
                ar1.instID AS instID1,
                ar2.instID AS instID2,
                COUNT(DISTINCT piar1.persID) AS weight
             FROM personInAlmanacRecords piar1
             JOIN almanacRecords ar1 ON piar1.almanacRecordID = ar1.ID
             JOIN personInAlmanacRecords piar2 ON piar2.persID = piar1.persID
             JOIN almanacRecords ar2 ON piar2.almanacRecordID = ar2.ID AND ar2.year = ar1.year
             ${edgeWhereClause}
               AND ar1.instID < ar2.instID
             GROUP BY ar1.instID, ar2.instID
             HAVING weight > 0`,
            { replacements: { ...replacements, instIDs }, type: db.Sequelize.QueryTypes.SELECT }
        );

        // Collect all institution IDs that appear in at least one edge
        const connectedIDs = new Set();
        for (const row of edges) {
            connectedIDs.add(row.instID1);
            connectedIDs.add(row.instID2);
        }
        if (connectedIDs.size === 0) return res.send({ nodes: [], edges: [] });

        // Get names and dioceses for all connected institutions (most recent name
        // in time window) — one batched query instead of one per institution
        const metaMap = {};
        const metaRows = await db.sequelize.query(
            `SELECT ar1.instID, ar1.instName, ar1.year, ar1.diocese_reg
             FROM almanacRecords ar1
             WHERE ar1.instID IN (:connectedIDs)
               ${endYear != null ? 'AND ar1.year <= :endYear' : ''}`,
            {
                replacements: { connectedIDs: Array.from(connectedIDs), endYear },
                type: db.Sequelize.QueryTypes.SELECT
            }
        );
        for (const rec of metaRows) {
            if (!metaMap[rec.instID] || rec.year > metaMap[rec.instID].year) {
                metaMap[rec.instID] = { instName: rec.instName, diocese: rec.diocese_reg, year: rec.year };
            }
        }
        for (const instID of connectedIDs) {
            if (!metaMap[instID]) {
                metaMap[instID] = { instName: instID, diocese: null };
            }
        }

        const edgeList = edges.map(row => ({
            from: row.instID1,
            to: row.instID2,
            weight: Number(row.weight),
            value: Number(row.weight),
            label: String(row.weight)
        }));

        // Weighted PageRank (using shared-person counts as edge weights)
        const nodeIDs = Array.from(connectedIDs);
        const pr = computePageRank(nodeIDs, edgeList);

        // Build nodes and edges, include diocese as group and pageRank for sizing
        const allNodes = nodeIDs.map(id => ({
            id,
            label: metaMap[id].instName,
            group: metaMap[id].diocese || 'Unknown',
            diocese: metaMap[id].diocese || 'Unknown',
            routeSegment: 'institutions',
            pageRank: pr[id],
            value: pr[id]
        }));

        // Cap the response at the most central nodes so huge unfiltered
        // queries stay renderable; truncated/totalNodes let the UI say so
        const result = truncateToTopNodes(allNodes, edgeList, limit);
        networkCache.set(key, result);
        res.send(result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
// Returns a bipartite network: institutions AND people as nodes, with an edge
// wherever a person appears in an institution's almanac records. Edge weight is
// the number of distinct years of that affiliation.
exports.getBipartiteNetwork = async (req, res) => {
    const { diocese, state, city, instType, instFunction, language, order, role, title } = req.query;
    const params = parseNetworkParams(req.query);
    if (params.error) {
        return res.status(400).json({ message: params.error });
    }
    const { startYear, endYear, limit } = params;

    const key = cacheKey('network/bipartite', req.query);
    const cached = networkCache.get(key);
    if (cached) return res.send(cached);

    const arWhere = [];
    const replacements = {};
    if (diocese) {
        arWhere.push('ar1.diocese_reg LIKE :diocese');
        replacements.diocese = `%${diocese}%`;
    }
    if (state) {
        arWhere.push('ar1.stateOrig LIKE :state');
        replacements.state = `%${state}%`;
    }
    if (city) {
        arWhere.push('ar1.cityOrig LIKE :city');
        replacements.city = `%${city}%`;
    }
    if (instType) {
        arWhere.push('ar1.instType LIKE :instType');
        replacements.instType = `%${instType}%`;
    }
    if (instFunction) {
        arWhere.push('ar1.instFunction LIKE :instFunction');
        replacements.instFunction = `%${instFunction}%`;
    }
    if (language) {
        arWhere.push('ar1.language LIKE :language');
        replacements.language = `%${language}%`;
    }
    if (role) {
        arWhere.push('piar1.role LIKE :role');
        replacements.role = `%${role}%`;
    }
    if (title) {
        arWhere.push('piar1.title LIKE :title');
        replacements.title = `%${title}%`;
    }
    if (order) {
        arWhere.push('ar1.ID IN (SELECT oiar.almanacRecordID FROM orderInAlmanacRecords oiar WHERE oiar.`order` LIKE :order)');
        replacements.order = `%${order}%`;
    }
    if (startYear != null && endYear != null) {
        arWhere.push('ar1.year BETWEEN :startYear AND :endYear');
        replacements.startYear = startYear;
        replacements.endYear = endYear;
    } else if (startYear != null) {
        arWhere.push('ar1.year >= :startYear');
        replacements.startYear = startYear;
    } else if (endYear != null) {
        arWhere.push('ar1.year <= :endYear');
        replacements.endYear = endYear;
    }
    const arWhereClause = arWhere.length ? 'WHERE ' + arWhere.join(' AND ') : '';

    try {
        // Every person-institution affiliation matching the filters
        const affiliations = await db.sequelize.query(
            `SELECT piar1.persID, ar1.instID, COUNT(DISTINCT ar1.year) AS weight
             FROM personInAlmanacRecords piar1
             JOIN almanacRecords ar1 ON piar1.almanacRecordID = ar1.ID
             ${arWhereClause}
             GROUP BY piar1.persID, ar1.instID`,
            { replacements, type: db.Sequelize.QueryTypes.SELECT }
        );
        if (affiliations.length === 0) return res.send({ nodes: [], edges: [], truncated: false, totalNodes: 0 });

        const persIDs = Array.from(new Set(affiliations.map(a => a.persID)));
        const instIDs = Array.from(new Set(affiliations.map(a => a.instID)));

        // Latest names within the filtered records, one batched query per side
        const persMeta = {};
        const persRows = await db.sequelize.query(
            `SELECT piar1.persID, piar1.name, ar1.year
             FROM personInAlmanacRecords piar1
             JOIN almanacRecords ar1 ON piar1.almanacRecordID = ar1.ID
             WHERE piar1.persID IN (:persIDs) ${arWhere.length ? 'AND ' + arWhere.join(' AND ') : ''}`,
            { replacements: { ...replacements, persIDs }, type: db.Sequelize.QueryTypes.SELECT }
        );
        for (const rec of persRows) {
            if (!persMeta[rec.persID] || rec.year > persMeta[rec.persID].year) {
                persMeta[rec.persID] = { name: rec.name || rec.persID, year: rec.year };
            }
        }

        const instMeta = {};
        const instRows = await db.sequelize.query(
            `SELECT ar1.instID, ar1.instName, ar1.year, ar1.diocese_reg
             FROM almanacRecords ar1
             WHERE ar1.instID IN (:instIDs)
               ${endYear != null ? 'AND ar1.year <= :endYear' : ''}`,
            { replacements: { instIDs, endYear }, type: db.Sequelize.QueryTypes.SELECT }
        );
        for (const rec of instRows) {
            if (!instMeta[rec.instID] || rec.year > instMeta[rec.instID].year) {
                instMeta[rec.instID] = { name: rec.instName || rec.instID, diocese: rec.diocese_reg, year: rec.year };
            }
        }

        const edgeList = affiliations.map(a => ({
            from: a.persID,
            to: a.instID,
            weight: Number(a.weight),
            value: Number(a.weight),
            label: String(a.weight)
        }));

        const nodeIDs = [...persIDs, ...instIDs];
        const pr = computePageRank(nodeIDs, edgeList);

        const allNodes = [
            ...persIDs.map(id => ({
                id,
                label: persMeta[id]?.name ?? id,
                group: 'people',
                routeSegment: 'people',
                pageRank: pr[id],
                value: pr[id]
            })),
            ...instIDs.map(id => ({
                id,
                label: instMeta[id]?.name ?? id,
                group: 'institutions',
                diocese: instMeta[id]?.diocese || 'Unknown',
                routeSegment: 'institutions',
                pageRank: pr[id],
                value: pr[id]
            }))
        ];

        const result = truncateToTopNodes(allNodes, edgeList, limit);
        networkCache.set(key, result);
        res.send(result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const db = require("../models");
const { Sequelize } = db.sequelize;
const getPagination = require("../utils/get-pagination");
const { parseNetworkParams, parseIntParam, computePageRank, truncateToTopNodes, networkCache, cacheKey } = require("../utils/network");
const Op = db.Sequelize.Op;
const { where } = require("sequelize");

const almanacRecord = db.almanacRecord;
const person = db.person;
const personInAlmanacRecord = db.personInAlmanacRecord;
const institution = db.institution;
const relatedInstitutions = db.relatedInstitutions;
const order = db.order;
const orderInAlmanacRecord = db.orderInAlmanacRecord;

/*exports.create = (req, res) => {
    const churches = req.body;

    const processedChurches = churches.map(institution => {
        const uniqueInstID = `${institution.year}-${institution.instID}`;
        const uniqueAttendingInstID = institution.uniqueAttendingInstID ? `${institution.year}-${institution.attendingInstID}` : null;
        return {
            ...institution,
            uniqueInstID: uniqueInstID,
            uniqueAttendingInstID: uniqueAttendingInstID
        }});

    almanacRecord.bulkCreate(processedChurches)
    .then(data => {
        res.send(data);
    })
    .catch(err => {
        res.status(500).send({
            message: err.message || "An error occurred while creating the almanacRecord."
        });
    });
};*/

exports.findAll = async (req, res) => {
    try {
        let {page, size} = req.query;
        if (!page) {
            page = 1;
        };
        if (!size) {
            size = 3;
        };
        let {limit, offset} = getPagination(page, size);
        let where = {};
        let persWhere = {};
        let orderWhere = {};
        let { instName, countyOrig, cityOrig, stateOrig, diocese, instStartYear, instEndYear, language, instType, instFunction, persName, instID, religiousOrder } = req.query;
        if (instName) {
            where.instName = { [Op.like]: `%${instName}%` };
        };
        if (diocese) {
            where.diocese_reg = { [Op.like]: `%${diocese}%` };
        };
        if (instStartYear && instEndYear) {
            where.year = {
              [Op.between]: [instStartYear, instEndYear]
            };
          } else if (instStartYear) {
            where.year = {
              [Op.gte]: instStartYear
            };
          } else if (instEndYear) {
            where.year = {
              [Op.lte]: instEndYear
            };
        };
        if (countyOrig) {
            where.countyOrig = { [Op.like]: `%${countyOrig}%` };
        };
        if (cityOrig) {
            where.cityOrig = { [Op.like]: `%${cityOrig}%` };
        };
        if (stateOrig) {
            where.stateOrig = { [Op.like]: `%${stateOrig}%` };
        };
        if (language) {
            where.language = { [Op.like]: `%${language}%` };
        };
        if (instType) {
            where.instType = { [Op.like]: `%${instType}%` };
        };
        if (instFunction) {
            where.instFunction = { [Op.like]: `%${instFunction}%` };
        };
        if (persName) {
            persWhere.name = { [Op.like]: `%${persName}%` };
        };
        if (instID) {
            where.instID = { [Op.like]: `%${instID}%` };
        };
        if (religiousOrder) {
            orderWhere.order = { [Op.like]: `%${religiousOrder}%` };
        };
        //console.log('-----------where', where);
        const data = await institution.findAndCountAll({
            distinct: true,
            attributes: ['ID'],
            include: [{
                model: almanacRecord,
                as: 'almanacRecord',
                where: where,
                required: Object.keys(persWhere).length > 0 || Object.keys(where).length > 0 || Object.keys(orderWhere).length > 0,
                attributes: ['instName', 'year','instType', 'diocese'],
                include: [{
                    model: person,
                    as: 'personInfo',
                    required: Object.keys(persWhere).length > 0,
                    attributes: ['ID'],
                    through: {
                        model: personInAlmanacRecord,
                        where: persWhere,
                        attributes: ['name','title', 'suffix', 'role', 'note'],
                    }}, {
                    model: order,
                    as: 'orders',
                    required: Object.keys(orderWhere).length > 0,
                    attributes: ['order'],
                    where: orderWhere,
                    through: {
                        model: orderInAlmanacRecord,
                        attributes: ['order', 'almanacRecordID']
                    }}]}],
            order: [[
                Sequelize.literal(`(
                        CASE 
                            WHEN (
                            SELECT \`instName\`
                            FROM \`almanacRecords\` ar
                            WHERE ar.\`instID\` = \`institution\`.\`ID\`
                            ORDER BY ar.\`year\` DESC
                            LIMIT 1
                            ) REGEXP '^[A-Za-z]' THEN 0
                            ELSE 1
                        END
                )`), 'ASC'
            ], [
                Sequelize.literal(`(
                    SELECT \`instName\`
                    FROM \`almanacRecords\` ar
                    WHERE ar.\`instID\` = \`institution\`.\`ID\`
                    ORDER BY ar.\`year\` DESC
                    LIMIT 1
                )`), 'ASC'
            ]],
            limit,
            offset
    });
        /**data.forEach(inst => {
            if (inst.almanacRecord && Array.isArray(inst.almanacRecord)) {
                inst.almanacRecord.sort((a, b) => a.year - b.year)
            }
        });
        data.sort((a, b) => {
            const aName = a.almanacRecord.length > 0 ? a.almanacRecord[a.almanacRecord.length - 1].instName : '';
            const bName = b.almanacRecord.length > 0 ? b.almanacRecord[b.almanacRecord.length - 1].instName : '';
            const aAlpha = /^[A-Za-z]/.test(aName);
            const bAlpha = /^[A-Za-z]/.test(bName);
            if (aAlpha && !bAlpha) return -1;
            if (!aAlpha && bAlpha) return 1;
            return aName.localeCompare(bName);
        });
        const start = offset;
        const end = offset + limit;
        const paginatedRows = data.slice(start, end);
        res.send({
            count: data.length,
            rows: paginatedRows,
        });*/
        data.rows.forEach(inst => {
            if (inst.almanacRecord && Array.isArray(inst.almanacRecord)) {
                inst.almanacRecord.sort((a, b) => a.year - b.year)
            }
        });
        res.send({
            count: data.count,
            rows: data.rows
        })
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

function uniqueBy(arr, keyFn) {
    const seen = new Set();
    return arr.filter(item => {
        const key = keyFn(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

exports.findByID = async (req, res) => {
    const id = req.params.id;
    allInstitutionsData = await institution.findAll({
        // fetch raw data from the database
        where: {
            [Op.or]: [
                { ID: id },
                Sequelize.where(
                    Sequelize.literal(`FIND_IN_SET('${id}', REPLACE(\`institution\`.\`ID\`,'&',','))`),
                    { [Op.gt]: 0 })
    ]
        },
        attributes: ['ID'],
        include: [{
                model: almanacRecord,
                as: 'almanacRecord',
                attributes: ['instName', 'year', 'language', 'instType', 'instNote', 'diocese', 'placeName', 'region', 'countyOrig', 'countyReg', 'cityOrig', 'cityReg', 'stateOrig', 'stateReg', 'latitude', 'longitude',
                    'member', 'memberType', 'affiliated'
                ],
                include: [{
                    model: almanacRecord,
                    as: 'attendingInstitutions',
                    attributes: ['instID', 'instName', 'year'],
                    through: {
                        attributes: ['attendingFrequency', 'note']
                    }}, {
                    model: almanacRecord,
                    as: 'attendedBy',
                    attributes: ['instID', 'instName', 'year'],
                    through: {
                        attributes: ['attendingFrequency', 'note']
                    }}
                    ,{
                    model: person,
                    as: 'personInfo',
                    attributes: ['ID'],
                    through: {
                        model: personInAlmanacRecord,
                        attributes: ['name','title', 'suffix', 'role', 'note', 'isAttending', 'attendingInstID'],
                    }},{
                    model: order,
                    as: 'orders',
                    attributes: ['order'],
                    through: {
                        model: orderInAlmanacRecord,
                        attributes: ['order', 'almanacRecordID']
                    }}
                ]
        }, {
            model: relatedInstitutions,
            as: 'relatedFirst',
            attributes: ['firstID', 'secondID', 'isSibling']
        }, {
            model: relatedInstitutions,
            as: 'relatedSecond',
            attributes: ['firstID', 'secondID', 'isSibling'],
        }
    ]
    });
    console.log('data', allInstitutionsData);

    // compile the metadata for "all years" (the most up-to-date information & all years & all dioceses & all related entries)
    if (allInstitutionsData) {
        processedAllInstitutionsData = [];
        for (data of allInstitutionsData) {
            let processedData = {
                instID: data.dataValues.ID,
                year: [],
                instName: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].instName,
                language: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].language,
                diocese: [],
                instType: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].instType,
                instNote: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].instNote,
                placeName: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].placeName,
                region: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].region,
                countyOrig: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].countyOrig,
                countyReg: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].countyReg,
                cityOrig: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].cityOrig,
                cityReg: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].cityReg,
                stateOrig: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].stateOrig,
                stateReg: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].stateReg,
                latitude: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].latitude,
                longitude: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].longitude,
                member: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].member,
                memberType: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].memberType,
                affiliated: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].affiliated,
                order: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].orders.map(order => order.order).join(', '),
                attendedBy: [],
                attendingInstitutions: [],
                relatedInstitutions: [],
                residingPersonInfo: [],
                visitingPersonInfo: [],
            };
            
            let existingAttendingInstIDs = [];
            let existingAttendedByInstIDs = [];
            let existingRelatedInstIDs = [];
            let existingResidingPersonIDs = [];
            let existingVisitingPersonIDs = [];

            // all the (unique) dioceses
            for (const record of data.dataValues.almanacRecord) {
                if (!processedData.diocese.includes(record.diocese)) {
                    processedData.diocese.push(record.diocese);
                }
            };

            // all the (unique) attending institutions, attended by institutions and persons
            for (let i = data.dataValues.almanacRecord.length - 1; i >= 0; i--) {
                let record = data.dataValues.almanacRecord[i];
                if (!processedData.year.includes(record.year)) {
                    processedData.year.push(record.year);
                }
                
                for (const attendingInst of record.attendingInstitutions) {
                    if (!existingAttendingInstIDs.includes(attendingInst.instID)) {
                        existingAttendingInstIDs.push(attendingInst.instID);
                        const instDetails = await institution.findAll({
                            where: { ID: attendingInst.instID },
                            attributes: ['ID'],
                            include: [{
                                model: almanacRecord,
                                as: 'almanacRecord',
                                attributes: ['instName', 'year'],
                            }]
                        });
                        let latestInstName = instDetails[0].almanacRecord[instDetails[0].almanacRecord.length - 1].instName;
                        let latestYear = instDetails[0].almanacRecord[instDetails[0].almanacRecord.length - 1].year;
                        //console.log('latestInstName', latestInstName);
                        processedData.attendingInstitutions.push({
                            instID: attendingInst.instID,
                            instName: attendingInst.instName,
                            year: attendingInst.year,
                            attendingFrequency: attendingInst.attendingInstitution.attendingFrequency,
                            note: attendingInst.attendingInstitution.note,
                            latestInstName: latestInstName,
                            latestYear: latestYear
                        });
                        //console.log('processedData.attendingInstitutions', processedData.attendingInstitutions);
                        }};
                
                for (const attendedInst of record.attendedBy) {
                    if (!existingAttendedByInstIDs.includes(attendedInst.instID)) {
                        existingAttendedByInstIDs.push(attendedInst.instID);
                        const instDetails = await institution.findAll({
                            where: { ID: attendedInst.instID },
                            attributes: ['ID'],
                            include: [{
                                model: almanacRecord,
                                as: 'almanacRecord',
                                attributes: ['instName', 'year'],
                            }]
                        });
                        let latestInstName = instDetails[0].almanacRecord[instDetails[0].almanacRecord.length - 1].instName;
                        let latestYear = instDetails[0].almanacRecord[instDetails[0].almanacRecord.length - 1].year;
                        processedData.attendedBy.push({
                            instID: attendedInst.instID,
                            instName: attendedInst.instName,
                            year: attendedInst.year,
                            attendingFrequency: attendedInst.attendingInstitution.attendingFrequency,
                            note: attendedInst.attendingInstitution.note,
                            latestInstName: latestInstName,
                            latestYear: latestYear
                        });}};
                
                for (const person of record.personInfo) {
                    if (!existingResidingPersonIDs.includes(person.ID) && !person.personInAlmanacRecord.isAttending) {
                        existingResidingPersonIDs.push(person.ID);
                        processedData.residingPersonInfo.push(person);
                    } else if (!existingVisitingPersonIDs.includes(person.ID) && person.personInAlmanacRecord.isAttending) {
                        existingVisitingPersonIDs.push(person.ID);
                        if (person.personInAlmanacRecord.attendingInstID) {
                        processedData.attendedBy = processedData.attendedBy.filter(inst => inst.instID !== person.personInAlmanacRecord.attendingInstID);
                        const instDetails = await institution.findAll({
                            where: { ID: person.personInAlmanacRecord.attendingInstID },
                            attributes: ['ID'],
                            include: [{
                                model: almanacRecord,
                                as: 'almanacRecord',
                                attributes: ['instName'],
                            }]
                        });
                        let latestInstName = instDetails[0].almanacRecord[instDetails[0].almanacRecord.length - 1].instName;
                        processedData.visitingPersonInfo.push({
                            ID: person.ID,
                            personInAlmanacRecord: {
                                ...person.personInAlmanacRecord.dataValues,
                                attendingInstName: latestInstName
                            },
                        });
                    } else {
                        processedData.visitingPersonInfo.push(person);
                    }
                }}
            };

            // all the related institutions
            const allRelatedInstitutions = [
                ...data.dataValues.relatedFirst,
                ...data.dataValues.relatedSecond
            ];

            const allRelatedInstIDs = new Set();

            allRelatedInstitutions.forEach(relatedInst => {
                allRelatedInstIDs.add(relatedInst.firstID);
                allRelatedInstIDs.add(relatedInst.secondID);
            });

            const uniqueRelatedInstIDs = Array.from(allRelatedInstIDs);
            existingRelatedInstIDs = uniqueRelatedInstIDs.filter(id => id !== data.dataValues.ID);
            for (const relatedInstID of existingRelatedInstIDs) {
                const relatedInstDetails = await institution.findAll({
                    where: { ID: relatedInstID },
                    attributes: ['ID'],
                    include: [{
                        model: almanacRecord,
                        as: 'almanacRecord',
                        attributes: ['instName', 'year', 'instType'],
                    }]
                });
                let latestInstName = relatedInstDetails[0].almanacRecord[relatedInstDetails[0].almanacRecord.length - 1].instName;
                let latestYear = relatedInstDetails[0].almanacRecord[relatedInstDetails[0].almanacRecord.length - 1].year;
                processedData.relatedInstitutions.push({
                    instID: relatedInstID,
                    instName: latestInstName,
                    year: latestYear,
                    instType: relatedInstDetails[0].almanacRecord[relatedInstDetails[0].almanacRecord.length - 1].instType,
                });
            }
            processedAllInstitutionsData.push(processedData);
        }

        // create a year-instID list for the year buttons so that the correct metadata shows up when clicking on a year button
        const instIDInYearDict = {};
        processedAllInstitutionsData.forEach(d => {
            d.year.forEach(y => {
                if (!instIDInYearDict[y]) {
                    instIDInYearDict[y] = [];
                }
                if (!instIDInYearDict[y].includes(d.instID)) {
                    instIDInYearDict[y].push(d.instID);
                }
            });
        });

        const sortedYears = Object.keys(instIDInYearDict).sort((a, b) => Number(a) - Number(b));
        const latestInstIDs = instIDInYearDict[sortedYears[sortedYears.length - 1]];
        const latestInstitutionData = processedAllInstitutionsData.find(d => latestInstIDs.includes(d.instID));
        
        const combined = {
            ...latestInstitutionData,
            instID: Array.from(new Set(processedAllInstitutionsData.map(d => d.instID))),
            year: Array.from(new Set(processedAllInstitutionsData.flatMap(d => d.year))),
            diocese: Array.from(new Set(processedAllInstitutionsData.flatMap(d => d.diocese))),
            attendedBy: uniqueBy(processedAllInstitutionsData.flatMap(d => d.attendedBy), x => x.instID),
            attendingInstitutions: uniqueBy(processedAllInstitutionsData.flatMap(d => d.attendingInstitutions), x => x.instID),
            relatedInstitutions: uniqueBy(processedAllInstitutionsData.flatMap(d => d.relatedInstitutions), x => x.instID),
            residingPersonInfo: uniqueBy(processedAllInstitutionsData.flatMap(d => d.residingPersonInfo), x => x.ID),
            visitingPersonInfo: uniqueBy(processedAllInstitutionsData.flatMap(d => d.visitingPersonInfo), x => x.ID),
            instIDInYear: instIDInYearDict,
        };
        combined.year.sort((a, b) => a - b);
        res.send(combined);
    }
    else {
        res.status(404).send({
            message: `Cannot find almanacRecord with id=${id}.`
        });
    }
};

exports.findOne = async (req, res) => {
    data = await institution.findOne({
        where: { ID: req.params.id },
        attributes: ['ID'],
        include: [{
            model: almanacRecord,
            as: 'almanacRecord',
            where: { year: req.params.year },
            attributes: ['instName', 'year', 'language', 'instType', 'instNote', 'diocese', 'placeName', 'region', 'countyOrig', 'countyReg', 'cityOrig', 'cityReg', 'stateOrig', 'stateReg', 'latitude', 'longitude',
                'member', 'memberType', 'affiliated'
            ],
            include: [{
                model: almanacRecord,
                as: 'attendingInstitutions',
                attributes: ['instID', 'instName', 'year'],
                through: {
                    attributes: ['attendingFrequency', 'note']
                }}, {
                model: almanacRecord,
                as: 'attendedBy',
                attributes: ['instID', 'instName', 'year'],
                through: {
                    attributes: ['attendingFrequency', 'note']
                }}
                ,{
                model: person,
                as: 'personInfo',
                attributes: ['ID'],
                through: {
                    model: personInAlmanacRecord,
                    attributes: ['name','title', 'suffix', 'role', 'note', 'isAttending', 'attendingInstID'],
                }}, {
                model: order,
                as: 'orders',
                attributes: ['order'],
                through: {
                    model: orderInAlmanacRecord,
                    attributes: ['order', 'almanacRecordID']
                }}
            ]
        }, {
            model: relatedInstitutions,
            as: 'relatedFirst',
            attributes: ['firstID', 'secondID', 'isSibling']
        }, {
            model: relatedInstitutions,
            as: 'relatedSecond',
            attributes: ['firstID', 'secondID', 'isSibling']
        }], 
});
    if (data) {
        let processedData = {
            instID: [data.dataValues.ID],
            instName: data.dataValues.almanacRecord[0].instName,
            language: data.dataValues.almanacRecord[0].language,
            diocese: [data.dataValues.almanacRecord[0].diocese],
            instType: data.dataValues.almanacRecord[0].instType,
            instNote: data.dataValues.almanacRecord[0].instNote,
            placeName: data.dataValues.almanacRecord[0].placeName,
            region: data.dataValues.almanacRecord[0].region,
            countyOrig: data.dataValues.almanacRecord[0].countyOrig,
            countyReg: data.dataValues.almanacRecord[0].countyReg,
            cityOrig: data.dataValues.almanacRecord[0].cityOrig,
            cityReg: data.dataValues.almanacRecord[0].cityReg,
            stateOrig: data.dataValues.almanacRecord[0].stateOrig,
            stateReg: data.dataValues.almanacRecord[0].stateReg,
            latitude: data.dataValues.almanacRecord[0].latitude,
            longitude: data.dataValues.almanacRecord[0].longitude,
            member: data.dataValues.almanacRecord[0].member,
            memberType: data.dataValues.almanacRecord[0].memberType,
            affiliated: data.dataValues.almanacRecord[0].affiliated,
            year: data.dataValues.almanacRecord[0].year,
            order: data.dataValues.almanacRecord[0].orders.map(order => order.order).join(', '),
            attendingInstitutions: [],
            attendedBy: [],
            parentInstitutions: [],
            childInstitutions: [],
            siblingInstitutions: [],
            residingPersonInfo: [],
            visitingPersonInfo: [],
        };

        // attending institutions, attended by institutions and persons
        for (const attendingInst of data.dataValues.almanacRecord[0].attendingInstitutions) {
            const instDetails = await institution.findAll({
                where: { ID: attendingInst.instID },
                attributes: ['ID'],
                include: [{
                    model: almanacRecord,
                    as: 'almanacRecord',
                    attributes: ['instName', 'year'],
                }]
            });
            let latestInstName = instDetails[0].almanacRecord[instDetails[0].almanacRecord.length - 1].instName;
            let latestYear = instDetails[0].almanacRecord[instDetails[0].almanacRecord.length - 1].year;
            processedData.attendingInstitutions.push({
                instID: attendingInst.instID,
                instName: attendingInst.instName,
                year: attendingInst.year,
                attendingFrequency: attendingInst.attendingInstitution.attendingFrequency,
                note: attendingInst.attendingInstitution.note,
                latestInstName: latestInstName,
                latestYear: latestYear
            });
        }

        for (const attendedInst of data.dataValues.almanacRecord[0].attendedBy) {
            const instDetails = await institution.findAll({
                where: { ID: attendedInst.instID },
                attributes: ['ID'],
                include: [{
                    model: almanacRecord,
                    as: 'almanacRecord',
                    attributes: ['instName', 'year'],
                }]
            });
            let latestInstName = instDetails[0].almanacRecord[instDetails[0].almanacRecord.length - 1].instName;
            let latestYear = instDetails[0].almanacRecord[instDetails[0].almanacRecord.length - 1].year;
            processedData.attendedBy.push({
                instID: attendedInst.instID,
                instName: attendedInst.instName,
                year: attendedInst.year,
                attendingFrequency: attendedInst.attendingInstitution.attendingFrequency,
                note: attendedInst.attendingInstitution.note,
                latestInstName: latestInstName,
                latestYear: latestYear
            });}

        for (const person of data.dataValues.almanacRecord[0].personInfo) {
            if (!person.personInAlmanacRecord.isAttending) {
                processedData.residingPersonInfo.push(person);
            } else {
                if (person.personInAlmanacRecord.attendingInstID) {
                    processedData.attendedBy = processedData.attendedBy.filter(inst => inst.instID !== person.personInAlmanacRecord.attendingInstID);
                    const instDetails = await institution.findAll({
                        where: { ID: person.personInAlmanacRecord.attendingInstID },
                        attributes: ['ID'],
                        include: [{
                            model: almanacRecord,
                            as: 'almanacRecord',
                            attributes: ['instName'],
                        }]
                    });
                    let latestInstName = instDetails[0].almanacRecord[instDetails[0].almanacRecord.length - 1].instName;
                    processedData.visitingPersonInfo.push({
                        ID: person.ID,
                        personInAlmanacRecord: {
                            ...person.personInAlmanacRecord.dataValues,
                            attendingInstName: latestInstName
                        },
                    });
                } else {
                    processedData.visitingPersonInfo.push(person);
                }
            }
        };

        const parentInstitutions = [
            ...data.dataValues.relatedSecond.filter(rel => rel.isSibling === false)
        ]

        const childInstitutions = [
            ...data.dataValues.relatedFirst.filter(rel => rel.isSibling === false)
        ]

        const siblingInstitutions = [
            ...data.dataValues.relatedFirst.filter(rel => rel.isSibling === true),
            ...data.dataValues.relatedSecond.filter(rel => rel.isSibling === true)
        ]

        const allParentInstIDs = new Set(parentInstitutions.map(rel => rel.firstID));
        const allChildInstIDs = new Set(childInstitutions.map(rel => rel.secondID));
        const allSiblingInstIDs = new Set();

        siblingInstitutions.forEach(rel => {
            allSiblingInstIDs.add(rel.firstID);
            allSiblingInstIDs.add(rel.secondID);
        });

        const uniqueParentInstIDs = Array.from(allParentInstIDs).filter(id => id !== data.dataValues.ID);
        const uniqueChildInstIDs = Array.from(allChildInstIDs).filter(id => id !== data.dataValues.ID);
        const uniqueSiblingInstIDs = Array.from(allSiblingInstIDs).filter(id => id !== data.dataValues.ID);

        for (const parentInstID of uniqueParentInstIDs) {
            const parentInstDetails = await institution.findAll({
                where: { ID: parentInstID },
                attributes: ['ID'],
                include: [{
                    model: almanacRecord,
                    as: 'almanacRecord',
                    where: {year: req.params.year},
                    attributes: ['instName', 'year', 'instType'],
                }]
            });
            if (parentInstDetails.length !== 0) {
                processedData.parentInstitutions.push({
                    instID: parentInstID,
                    instName: parentInstDetails[0].almanacRecord[0].instName,
                    year: parentInstDetails[0].almanacRecord[0].year,
                    instType: parentInstDetails[0].almanacRecord[0].instType
                });
        }
        }

        for (const childInstID of uniqueChildInstIDs) {
            const childInstDetails = await institution.findAll({
                where: { ID: childInstID },
                attributes: ['ID'],
                include: [{
                    model: almanacRecord,
                    as: 'almanacRecord',
                    where: {year: req.params.year},
                    attributes: ['instName', 'year', 'instType'],
                }]
            });
            if (childInstDetails.length !== 0) {
                processedData.childInstitutions.push({
                    instID: childInstID,
                    instName: childInstDetails[0].almanacRecord[0].instName,
                    year: childInstDetails[0].almanacRecord[0].year,
                    instType: childInstDetails[0].almanacRecord[0].instType
                });
        }
        };

        for (const siblingInstID of uniqueSiblingInstIDs) {
            const siblingInstDetails = await institution.findAll({
                where: { ID: siblingInstID },
                attributes: ['ID'],
                include: [{
                    model: almanacRecord,
                    as: 'almanacRecord',
                    where: {year: req.params.year},
                    attributes: ['instName', 'year', 'instType'],
                }]
            });
            if (siblingInstDetails.length !== 0) {
                processedData.siblingInstitutions.push({
                    instID: siblingInstID,
                    instName: siblingInstDetails[0].almanacRecord[0].instName,
                    year: siblingInstDetails[0].almanacRecord[0].year,
                    instType: siblingInstDetails[0].almanacRecord[0].instType
                });
        }
        };

        res.send(processedData);
    } else {
        res.status(404).send({
            message: `Cannot find almanacRecord with id=${req.params.id}.`
        });
    }
};

exports.getPersonNetwork = async (req, res) => {
    const id = req.params.id;
    const params = parseNetworkParams(req.query);
    if (params.error) {
        return res.status(400).json({ message: params.error });
    }
    const { startYear, endYear } = params;

    const yearClause = (alias) => {
        if (startYear && endYear) return `AND ${alias}.year BETWEEN :startYear AND :endYear`;
        if (startYear) return `AND ${alias}.year >= :startYear`;
        if (endYear)   return `AND ${alias}.year <= :endYear`;
        return '';
    };
    const replacements = { targetInstID: id, startYear, endYear };

    try {
        // Get the most recent name for the target institution
        const [targetRows] = await db.sequelize.query(
            `SELECT instName
             FROM \`almanacRecords\`
             WHERE instID = :targetInstID
             ORDER BY year DESC
             LIMIT 1`,
            { replacements, type: db.Sequelize.QueryTypes.SELECT }
        );

        if (!targetRows) {
            return res.status(404).json({ message: `Cannot find institution with id=${id}.` });
        }

        // For each person who appeared at the target institution within the time window,
        // find every other institution that same person appeared at, and count distinct persons per pair.
        const edges = await db.sequelize.query(
            `SELECT
                ar2.instID AS instID,
                (
                    SELECT sub.instName
                    FROM \`almanacRecords\` sub
                    WHERE sub.instID = ar2.instID
                    ORDER BY sub.year DESC
                    LIMIT 1
                ) AS instName,
                COUNT(DISTINCT piar1.persID) AS weight
             FROM \`personInAlmanacRecords\` piar1
             JOIN \`almanacRecords\` ar1  ON piar1.almanacRecordID = ar1.ID ${yearClause('ar1')}
             JOIN \`personInAlmanacRecords\` piar2 ON piar2.persID = piar1.persID
             JOIN \`almanacRecords\` ar2  ON piar2.almanacRecordID = ar2.ID AND ar2.year = ar1.year
             WHERE ar1.instID = :targetInstID
               AND ar2.instID != :targetInstID
             GROUP BY ar2.instID
             ORDER BY weight DESC`,
            { replacements, type: db.Sequelize.QueryTypes.SELECT }
        );

        const nodes = [
            {
                id: id,
                label: targetRows.instName,
                isTarget: true,
                routeSegment: 'institutions',
                color: { border: '#003B1F', background: '#003B1F' },
                font: { color: '#ffffff', strokeColor: '#003B1F' },
                size: 30,
                borderWidth: 3
            },
            ...edges.map(row => ({
                id: row.instID,
                label: row.instName,
                isTarget: false,
                routeSegment: 'institutions'
            }))
        ];

        const edgeList = edges.map(row => ({
            from: id,
            to: row.instID,
            weight: Number(row.weight),
            value: Number(row.weight),
            label: String(row.weight)
        }));

        // Find pairwise shared-person counts among all neighbor institutions (excluding target)
        const neighborIDs = edges.map(row => row.instID);
        if (neighborIDs.length > 1) {
            const neighborEdges = await db.sequelize.query(
                `SELECT
                    ar1.instID AS instID1,
                    ar2.instID AS instID2,
                    COUNT(DISTINCT piar1.persID) AS weight
                 FROM \`personInAlmanacRecords\` piar1
                 JOIN \`almanacRecords\` ar1  ON piar1.almanacRecordID = ar1.ID ${yearClause('ar1')}
                 JOIN \`personInAlmanacRecords\` piar2 ON piar2.persID = piar1.persID
                 JOIN \`almanacRecords\` ar2  ON piar2.almanacRecordID = ar2.ID AND ar2.year = ar1.year
                 WHERE ar1.instID IN (:neighborIDs)
                   AND ar2.instID IN (:neighborIDs)
                   AND ar1.instID < ar2.instID
                 GROUP BY ar1.instID, ar2.instID
                 HAVING weight > 0`,
                { replacements: { ...replacements, neighborIDs }, type: db.Sequelize.QueryTypes.SELECT }
            );

            for (const row of neighborEdges) {
                edgeList.push({
                    from: row.instID1,
                    to: row.instID2,
                    weight: Number(row.weight),
                    value: Number(row.weight),
                    label: String(row.weight)
                });
            }
        }

        res.send({ nodes, edges: edgeList });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

exports.getDendrogramData = async (req, res) => {
    const targetID = req.params.id;
    const yearParam = parseIntParam(req.query.year, 'year');
    if (yearParam.error) {
        return res.status(400).json({ message: yearParam.error });
    }
    const year = yearParam.value;

    try {
        const targetExists = await institution.findOne({ where: { ID: targetID }, attributes: ['ID'] });
        if (!targetExists) {
            return res.status(404).json({ message: `Cannot find institution with id=${targetID}.` });
        }

        /* Load relationships, optionally filtered to a specific almanac year.
        relatedInstitutions.almanacRecordID -> almanacRecord.ID -> almanacRecord.year */
        const findAllOptions = {
            attributes: ['firstID', 'secondID', 'isSibling']
        };
        if (year) {
            findAllOptions.include = [{
                model: almanacRecord,
                as: 'almanacRecord',
                attributes: [],
                where: { year },
                required: true
            }];
        }
        const allRels = await relatedInstitutions.findAll(findAllOptions);

        /* Build deduplicated relationship maps
        isSibling=false: firstID is parent, secondID is child
        isSibling=true:  firstID and secondID are siblings */
        const parentOf = {}; 
        const childrenOf = {};
        const siblingsOf = {};

        for (const rel of allRels) {
            const a = rel.firstID, b = rel.secondID;
            if (!rel.isSibling) {
                parentOf[b] = a;
                if (!childrenOf[a]) childrenOf[a] = new Set();
                childrenOf[a].add(b);
            } else {
                if (!siblingsOf[a]) siblingsOf[a] = new Set();
                if (!siblingsOf[b]) siblingsOf[b] = new Set();
                siblingsOf[a].add(b);
                siblingsOf[b].add(a);
            }
        }

        // BFS in all directions (up, down, sideways) from the target
        // to find the full connected family of institutions
        const connected = new Set();
        const queue = [targetID];
        while (queue.length > 0) {
            const current = queue.shift();
            if (connected.has(current)) continue;
            connected.add(current);
            if (parentOf[current]) queue.push(parentOf[current]);
            for (const c of (childrenOf[current] || [])) queue.push(c);
            for (const s of (siblingsOf[current] || [])) queue.push(s);
        }

        /* Re-parent nodes whose ID naming convention implies a closer parent than
        what the DB recorded. The DB sometimes stores a grandparent relationship
        (e.g. phi.pa.0006 → phi.pa.0006_02.01) when the ID suffix structure
        makes the real parent clear (phi.pa.0006_02 → phi.pa.0006_02.01).
        Only re-parent when the implied parent actually exists in the connected family. */
        function getImpliedParent(instID) {
            if (instID.includes(' & ')) return null;
            // Level 2 child:  city.state.NNNN_NN.NN  →  city.state.NNNN_NN
            const level2 = instID.match(/^(.+_\d+)\.\d+$/);
            if (level2) return level2[1];
            // Level 1 child:  city.state.NNNN_NN     →  city.state.NNNN
            const level1 = instID.match(/^(.+)_\d+$/);
            if (level1) return level1[1];
            return null;
        }

        for (const nodeID of connected) {
            const impliedParentID = getImpliedParent(nodeID);
            if (!impliedParentID || !connected.has(impliedParentID)) continue;
            const dbParentID = parentOf[nodeID];
            if (dbParentID === impliedParentID) continue; // already correct
            // Remove from the DB-recorded parent's children
            if (dbParentID && childrenOf[dbParentID]) {
                childrenOf[dbParentID].delete(nodeID);
            }
            // Attach to the implied (closer) parent
            if (!childrenOf[impliedParentID]) childrenOf[impliedParentID] = new Set();
            childrenOf[impliedParentID].add(nodeID);
            parentOf[nodeID] = impliedParentID;
        }

        // True roots = nodes in the connected family that have no parent
        // within that family (i.e. top of the chain)
        const trueRoots = Array.from(connected).filter(id =>
            !parentOf[id] || !connected.has(parentOf[id])
        );

        // Fetch the instName/year for an institution (cached).
        // If a year filter is active, resolve the most recent name at or before that year.
        const nameCache = {};
        async function getLatestName(instID) {
            if (nameCache[instID]) return nameCache[instID];
            const whereClause = { instID };
            if (year) whereClause.year = { [Op.lte]: year };
            const rec = await almanacRecord.findOne({
                where: whereClause,
                attributes: ['instName', 'year'],
                order: [['year', 'DESC']]
            });
            nameCache[instID] = rec
                ? { instName: rec.instName, year: rec.year }
                : { instName: instID, year: null };
            return nameCache[instID];
        }

        /* Recursively build the d3-hierarchy tree downward from a node,
        staying within the connected family to avoid pulling unrelated subtrees*/
        async function buildNode(instID, visited = new Set()) {
            if (visited.has(instID)) return null; // cycle guard
            visited.add(instID);

            const { instName, year } = await getLatestName(instID);
            const node = { name: instName, instID, year };

            const childIDs = [...(childrenOf[instID] || [])].filter(id => connected.has(id));
            if (childIDs.length > 0) {
                const childNodes = await Promise.all(
                    childIDs.map(cid => buildNode(cid, new Set(visited)))
                );
                node.children = childNodes.filter(Boolean);
            }
            return node;
        }

        let tree;
        if (trueRoots.length === 1) {
            tree = await buildNode(trueRoots[0]);
        } else {
            /* Multiple roots connected only via sibling links (no common parent in DB).
            Wrap them in a virtual grouping node so d3 always gets a single root. */
            const rootNodes = await Promise.all(trueRoots.map(id => buildNode(id)));
            const { instName, year } = await getLatestName(targetID);
            tree = {
                name: instName,
                instID: targetID,
                year,
                virtual: true,
                children: rootNodes.filter(Boolean)
            };
        }

        res.send(tree);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

exports.delete = (req, res) => {
    const id = req.params.instID;
    institution.destroy({
        where: { instID: id }
    })
    .then(data => {
        if (!data) {
            res.status(404).send({
                message: `Cannot delete almanacRecord with id=${id}. Maybe almanacRecord was not found!`
            });
        } else {
            res.send({
                message: "almanacRecord was deleted successfully!"
            });
        }
    }).catch(err => {
        res.status(500).send({
            message: "Could not delete almanacRecord with id=" + id
        });
    });
};