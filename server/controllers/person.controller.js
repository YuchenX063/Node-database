// Returns a network graph of all people connected by shared institutions, with optional filters
exports.getAllPersonNetwork = async (req, res) => {
    const { diocese, state, city, role, title, order } = req.query;
    const params = parseNetworkParams(req.query);
    if (params.error) {
        return res.status(400).json({ message: params.error });
    }
    const { startYear, endYear, limit } = params;

    const key = cacheKey('person/network', req.query);
    const cached = networkCache.get(key);
    if (cached) return res.send(cached);

    // Build WHERE clauses for almanacRecord (not person)
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
    // role/title live on the person-record join (piar1), which is present in
    // every query these clauses are used in
    if (role) {
        arWhere.push('piar1.role LIKE :role');
        replacements.role = `%${role}%`;
    }
    if (title) {
        arWhere.push('piar1.title LIKE :title');
        replacements.title = `%${title}%`;
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
        // Get all person IDs matching filters (from almanacRecord join)
        const pers = await db.sequelize.query(
            `SELECT DISTINCT piar1.persID FROM personInAlmanacRecords piar1
             JOIN almanacRecords ar1 ON piar1.almanacRecordID = ar1.ID
             ${arWhereClause}`,
            { replacements, type: db.Sequelize.QueryTypes.SELECT }
        );
        const persIDs = pers.map(i => i.persID);
        if (persIDs.length === 0) return res.send({ nodes: [], edges: [] });

        // Find all pairs of people that share at least one institution in common in the time window
        // Only include people in persIDs
        // Apply the same filters to ar1 in the join
        const edgeWhere = [];
        if (persIDs.length) {
            edgeWhere.push('piar1.persID IN (:persIDs)');
            edgeWhere.push('piar2.persID IN (:persIDs)');
        }
        if (arWhere.length) {
            // Only apply filters to ar1 (not ar2)
            edgeWhere.push(...arWhere);
        }
        const edgeWhereClause = edgeWhere.length ? 'WHERE ' + edgeWhere.join(' AND ') : '';
        const edges = await db.sequelize.query(
            `SELECT
                piar1.persID AS persID1,
                piar2.persID AS persID2,
                COUNT(DISTINCT ar1.instID) AS weight
             FROM personInAlmanacRecords piar1
             JOIN almanacRecords ar1 ON piar1.almanacRecordID = ar1.ID
             JOIN personInAlmanacRecords piar2 ON piar2.almanacRecordID = ar1.ID AND piar2.persID != piar1.persID
             ${edgeWhereClause}
               AND piar1.persID < piar2.persID
             GROUP BY piar1.persID, piar2.persID
             HAVING weight > 0`,
            { replacements: { ...replacements, persIDs }, type: db.Sequelize.QueryTypes.SELECT }
        );

        // Collect all person IDs that appear in at least one edge
        const connectedIDs = new Set();
        for (const row of edges) {
            connectedIDs.add(row.persID1);
            connectedIDs.add(row.persID2);
        }
        if (connectedIDs.size === 0) return res.send({ nodes: [], edges: [] });

        // For each connected person, take name and diocese from their most recent
        // record matching the filters — one batched query instead of one per edge
        const personMeta = {};
        const metaWhere = ['piar1.persID IN (:connectedIDs)', ...arWhere];
        const metaRows = await db.sequelize.query(
            `SELECT piar1.persID, piar1.name, ar1.year, ar1.diocese_reg
             FROM personInAlmanacRecords piar1
             JOIN almanacRecords ar1 ON piar1.almanacRecordID = ar1.ID
             WHERE ${metaWhere.join(' AND ')}`,
            {
                replacements: { ...replacements, connectedIDs: Array.from(connectedIDs) },
                type: db.Sequelize.QueryTypes.SELECT
            }
        );
        for (const rec of metaRows) {
            if (!personMeta[rec.persID] || rec.year > personMeta[rec.persID].year) {
                personMeta[rec.persID] = {
                    year: rec.year,
                    diocese: rec.diocese_reg || 'Unknown',
                    name: rec.name || rec.persID
                };
            }
        }
        // Every connected person matched the filters, but guard against gaps anyway
        for (const persID of connectedIDs) {
            if (!personMeta[persID]) {
                personMeta[persID] = { year: null, diocese: 'Unknown', name: persID };
            }
        }

        const edgeList = edges.map(row => ({
            from: row.persID1,
            to: row.persID2,
            weight: Number(row.weight),
            value: Number(row.weight),
            label: String(row.weight)
        }));

        // Weighted PageRank (using shared-institution counts as edge weights)
        const nodeIDs = Array.from(connectedIDs);
        const pr = computePageRank(nodeIDs, edgeList);

        // Build nodes, include diocese as group and pageRank for sizing
        const allNodes = nodeIDs.map(id => {
            let diocese = personMeta[id].diocese;
            if (!diocese || typeof diocese !== 'string' || !diocese.trim()) {
                diocese = 'Unknown';
            } else {
                diocese = diocese.trim();
            }
            return {
                id,
                label: personMeta[id].name,
                group: diocese,
                diocese,
                routeSegment: 'people',
                pageRank: pr[id],
                value: pr[id]
            };
        });

        // Cap the response at the most central nodes so huge unfiltered
        // queries stay renderable; truncated/totalNodes let the UI say so
        const result = truncateToTopNodes(allNodes, edgeList, limit);
        networkCache.set(key, result);
        res.send(result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
const { where } = require("sequelize");
const db = require("../models");
const Op = db.Sequelize.Op;
const { Sequelize } = db.sequelize;

const getPagination = require("../utils/get-pagination");
const { parseNetworkParams, computePageRank, truncateToTopNodes, networkCache, cacheKey } = require("../utils/network");
const religiousOrderDict = require('../config/religiousOrderDict.json')

const almanacRecord = db.almanacRecord;
const personInAlmanacRecord = db.personInAlmanacRecord;
const person = db.person;

/*exports.create = (req, res) => {
    const persons = req.body;

    const processedPersons = persons.map(person => {
        const uniquePersID = `${person.persYear}-${person.persID}`;
        return {
            ...person,
            uniquePersID: uniquePersID
        };});

    Person.bulkCreate(processedPersons)
    .then(data => {
        res.send(data);
    })
    .catch(err => {
        res.status(500).send({
            message: err.message || "An error occurred while creating the Person."
        });
    });
};*/

exports.findAll = (req, res) => {
    let {page, size} = req.query;
    console.log(req.query);
    if (!page) {
        page = 1;
    };
    if (!size) {
        size = 3;
    };
    let {limit, offset} = getPagination(page, size);
    let persWhere = {};
    let instWhere = {};
    let { persName, instName, diocese, countyOrig, cityOrig, stateOrig, instStartYear, instEndYear, religiousOrder } = req.query;
    if (persName) {
        persWhere.name = { [Op.like]: `%${persName}%` };
    };
    if (instName) {
        instWhere.instName = { [Op.like]: `%${instName}%` };
    };
    if (countyOrig) {
        instWhere.countyOrig = { [Op.like]: `%${countyOrig}%` };
    };
    if (cityOrig) {
        instWhere.cityOrig = { [Op.like]: `%${cityOrig}%` };
    };
    if (stateOrig) {
        instWhere.stateOrig = { [Op.like]: `%${stateOrig}%` };
    };
    if (instStartYear && instEndYear) {
        instWhere.year = { [Op.between]: [instStartYear, instEndYear] };
    } else if (instStartYear) {
        instWhere.year = { [Op.gte]: instStartYear };
    } else if (instEndYear) {
        instWhere.year = { [Op.lte]: instEndYear };
    };
    if (diocese) {
        instWhere.diocese_reg = { [Op.like]: `%${diocese}%` };
    };
    if (religiousOrder) {
        let equivalents = null;
        for (const group of Object.values(religiousOrderDict)) {
            if (group.includes(religiousOrder)) {
                equivalents = group;
                break;
            }
        }
        if (!equivalents && religiousOrderDict[religiousOrder]) {
            equivalents = religiousOrderDict[religiousOrder];
        }
        if (!equivalents) {
            equivalents = [religiousOrder];
        }
        instWhere.religiousOrder = {
            [Op.or]: equivalents.map(order => ({ [Op.like]: `%${order}%` }))
        };  
    };

    person.findAndCountAll({
        distinct: true,
        attributes: ['ID'],
        include: [
            {
                model: almanacRecord,
                where: instWhere,
                as: 'almanacRecords',
                attributes: ['instID','instName','year','cityReg', 'diocese', 'latitude', 'longitude'],
                through: {
                    model: personInAlmanacRecord,
                    where: persWhere,
                    attributes: ['name', 'lastName', 'title', 'suffix', 'role', 'note']
                }
            }
        ],
        order: [[
            Sequelize.literal(`(
                CASE 
                    WHEN (
                    SELECT pir.\`lastName\`
                    FROM \`personInAlmanacRecords\` pir
                    JOIN \`almanacRecords\` ar ON pir.\`almanacRecordID\` = ar.\`ID\`
                    WHERE pir.\`persID\` = \`person\`.\`ID\`
                    ORDER BY ar.\`year\` DESC
                    LIMIT 1
                    ) REGEXP '^[A-Za-z]' THEN 0
                    ELSE 1
                END
            )`), 'ASC'
        ], [
                Sequelize.literal(`(
                    SELECT pir.\`lastName\`
                    FROM \`personInAlmanacRecords\` pir
                    JOIN \`almanacRecords\` ar ON pir.\`almanacRecordID\` = ar.\`ID\`
                    WHERE pir.\`persID\` = \`person\`.\`ID\`
                    ORDER BY ar.\`year\` DESC
                    LIMIT 1
                    )`), 'ASC'
        ]
    ],
        limit,
        offset
    }).then(
        data => {
        /**data.forEach(person => {
            if (person.almanacRecords && Array.isArray(person.almanacRecords)) {
                person.almanacRecords.sort((a, b) => a.year - b.year);
            }
        });
        data.sort((a, b) => {
            const aName = a.almanacRecords.length > 0 ? a.almanacRecords[a.almanacRecords.length - 1].personInAlmanacRecord.name : '';
            const bName = b.almanacRecords.length > 0 ? b.almanacRecords[b.almanacRecords.length - 1].personInAlmanacRecord.name : '';
            const aAlpha = /^[A-Za-z]/.test(aName);
            const bAlpha = /^[A-Za-z]/.test(bName);
            if (aAlpha && !bAlpha) return -1;
            if (!aAlpha && bAlpha) return 1;
            return aName.localeCompare(bName);
        });
        const start = offset;
        const end = offset + limit;
        const paginatedRows = data.slice(start, end); */
        data.rows.forEach(person => {
            if (person.almanacRecords && Array.isArray(person.almanacRecords)) {
                person.almanacRecords.sort((a, b) => a.year - b.year);
            }
        });
        res.send({
            count: data.count,
            rows: data.rows,
        });
    }).catch(err => {
        res.status(500).send({
            message: err.message || "An error occurred while retrieving people."
        });
    });
};

exports.findByID = async (req, res) => {
    const id = req.params.id;
    data = await person.findOne({
        where: { ID: id },
        attributes: ['ID'],
        include: [
            {
                model: almanacRecord,
                as: 'almanacRecords',
                attributes: ['instID','instName','year','cityReg', 'diocese', 'latitude', 'longitude'],
                through: {
                    model: personInAlmanacRecord,
                    attributes: ['name', 'title', 'suffix', 'role', 'note', 'isAttending', 'attendingInstID']
                }
            }]}
    );
    if (data) {
        let processedData = {
            persID: data.dataValues.ID,
            name: [],
            title: data.dataValues.almanacRecords[data.dataValues.almanacRecords.length - 1].personInAlmanacRecord.title,
            suffix: data.dataValues.almanacRecords[data.dataValues.almanacRecords.length - 1].personInAlmanacRecord.suffix,
            note: data.dataValues.almanacRecords[data.dataValues.almanacRecords.length - 1].personInAlmanacRecord.note,
            role: [],
            residingInstitutions: [],
            visitingInstitutions: [],
            allInstitutions: [],
            year: [],
            dioceses: []
        }
        let existingAlmanacRecords = [];
        let existingYears = [];
        let existingRoles = [];
        let existingDioceses = [];
        let existingNames = [];
        for (let i = data.dataValues.almanacRecords.length - 1; i >= 0; i--) {
            let almanacRecord = data.dataValues.almanacRecords[i];
            if (!existingAlmanacRecords.includes(almanacRecord.instID)) {
                existingAlmanacRecords.push(almanacRecord.instID);
                if (almanacRecord.personInAlmanacRecord.isAttending) {
                    processedData.visitingInstitutions.push({
                        instID: almanacRecord.instID,
                        instName: almanacRecord.instName,
                        year: almanacRecord.year,
                        cityReg: almanacRecord.cityReg,
                        diocese: almanacRecord.diocese,
                        latitude: almanacRecord.latitude,
                        longitude: almanacRecord.longitude,
                        personInAlmanacRecord: almanacRecord.personInAlmanacRecord
                })
                } else {
                    processedData.residingInstitutions.push({
                        instID: almanacRecord.instID,
                        instName: almanacRecord.instName,
                        year: almanacRecord.year,
                        cityReg: almanacRecord.cityReg,
                        diocese: almanacRecord.diocese,
                        latitude: almanacRecord.latitude,
                        longitude: almanacRecord.longitude,
                        personInAlmanacRecord: almanacRecord.personInAlmanacRecord
                    });
                }
            }
            if (!existingRoles.includes(almanacRecord.personInAlmanacRecord.role)) {
                if (almanacRecord.personInAlmanacRecord.role) {
                    existingRoles.push(almanacRecord.personInAlmanacRecord.role);
                    processedData.role.push(almanacRecord.personInAlmanacRecord.role);
                }
            }
        }
        for (let i = 0; i < data.dataValues.almanacRecords.length; i++) {
            let almanacRecord = data.dataValues.almanacRecords[i];
            if (!existingYears.includes(almanacRecord.year)){
                existingYears.push(almanacRecord.year);
                processedData.year.push(almanacRecord.year);
            };
            if (!existingDioceses.includes(almanacRecord.diocese)) {
                existingDioceses.push(almanacRecord.diocese);
                processedData.dioceses.push(almanacRecord.diocese);
            };
            if (!existingNames.includes(almanacRecord.personInAlmanacRecord.name)) {
                existingNames.push(almanacRecord.personInAlmanacRecord.name);
                processedData.name.push(almanacRecord.personInAlmanacRecord.name);
            }
        }
        processedData.year.sort((a, b) => a - b);
        processedData.allInstitutions = [...processedData.residingInstitutions, ...processedData.visitingInstitutions];
        res.send(processedData);
    } else {
        res.status(404).send({
            message: `Cannot find Person with id=${id}.`
        });
    }
};

exports.findOne = async (req, res) => {
    data = await person.findOne({
        attributes: ['ID'],
        include: [{
            model: almanacRecord,
            as: 'almanacRecords',
            where: { year: req.params.year },
            attributes: ['instID','instName','year', 'cityReg', 'diocese', 'latitude', 'longitude'],
            through: {
                model: personInAlmanacRecord,
                where: { persID: req.params.id },
                attributes: ['name', 'title', 'suffix', 'role', 'note', 'isAttending', 'attendingInstID']
            }
        }]
    });
    if (data) {
        let processedData = {
            persID: data.dataValues.ID,
            name: [],
            title: data.dataValues.almanacRecords[0].personInAlmanacRecord.title,
            suffix: data.dataValues.almanacRecords[0].personInAlmanacRecord.suffix,
            note: data.dataValues.almanacRecords[0].personInAlmanacRecord.note,
            residingInstitutions: [],
            visitingInstitutions: [],
            allInstitutions: [],
            year: data.dataValues.almanacRecords[0].year,
            dioceses: [],
            role: [],
        }
        let existingRoles = [];
        let existingAlmanacRecords = [];
        let existingDioceses = [];
        let existingNames = [];
        for (let i = data.dataValues.almanacRecords.length - 1; i >= 0; i--) {
            let almanacRecord = data.dataValues.almanacRecords[i];
            if (!existingRoles.includes(almanacRecord.personInAlmanacRecord.role)) {
                existingRoles.push(almanacRecord.personInAlmanacRecord.role);
                processedData.role.push(almanacRecord.personInAlmanacRecord.role);
            };
            if (!existingAlmanacRecords.includes(almanacRecord.instID)) {
                existingAlmanacRecords.push(almanacRecord.instID);
                if (almanacRecord.personInAlmanacRecord.isAttending) {
                    processedData.visitingInstitutions.push({
                        instID: almanacRecord.instID,
                        instName: almanacRecord.instName,
                        year: almanacRecord.year,
                        cityReg: almanacRecord.cityReg,
                        diocese: almanacRecord.diocese,
                        latitude: almanacRecord.latitude,
                        longitude: almanacRecord.longitude,
                        personInAlmanacRecord: almanacRecord.personInAlmanacRecord
                    });
                } else {
                    processedData.residingInstitutions.push({
                        instID: almanacRecord.instID,
                        instName: almanacRecord.instName,
                        year: almanacRecord.year,
                        cityReg: almanacRecord.cityReg,
                        diocese: almanacRecord.diocese,
                        latitude: almanacRecord.latitude,
                        longitude: almanacRecord.longitude,
                        personInAlmanacRecord: almanacRecord.personInAlmanacRecord
                    });
                }
            };
            if (!existingNames.includes(almanacRecord.personInAlmanacRecord.name)) {
                existingNames.push(almanacRecord.personInAlmanacRecord.name);
                processedData.name.push(almanacRecord.personInAlmanacRecord.name);
            }
        };
        for (let i = 0; i < data.dataValues.almanacRecords.length; i++) {
            let almanacRecord = data.dataValues.almanacRecords[i];
            if (!existingDioceses.includes(almanacRecord.diocese)) {
                existingDioceses.push(almanacRecord.diocese);
                processedData.dioceses.push(almanacRecord.diocese);
            }
        }
        processedData.allInstitutions = [...processedData.residingInstitutions, ...processedData.visitingInstitutions];
        res.send(processedData);
    } else {
        res.status(404).send({
            message: `Cannot find Person with id=${req.params.id}.`
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

    // Build an optional year-range clause applied to almanacRecord joins
    const yearClause = (alias) => {
        if (startYear && endYear) return `AND ${alias}.year BETWEEN :startYear AND :endYear`;
        if (startYear) return `AND ${alias}.year >= :startYear`;
        if (endYear)   return `AND ${alias}.year <= :endYear`;
        return '';
    };
    const replacements = { targetPersID: id, startYear, endYear };

    try {
        // Get the most recent name for the target person
        const [targetRows] = await db.sequelize.query(
            `SELECT name
             FROM \`personInAlmanacRecords\`
             WHERE persID = :targetPersID
             ORDER BY almanacRecordID DESC
             LIMIT 1`,
            { replacements, type: db.Sequelize.QueryTypes.SELECT }
        );

        if (!targetRows) {
            return res.status(404).json({ message: `Cannot find person with id=${id}.` });
        }

        // Find every other person who appeared at the same institution within the time window,
        // and count how many distinct institutions they share.
        const edges = await db.sequelize.query(
            `SELECT
                piar2.persID AS persID,
                (
                    SELECT sub.name
                    FROM \`personInAlmanacRecords\` sub
                    WHERE sub.persID = piar2.persID
                    ORDER BY sub.almanacRecordID DESC
                    LIMIT 1
                ) AS name,
                COUNT(DISTINCT ar1.instID) AS weight
             FROM \`personInAlmanacRecords\` piar1
             JOIN \`almanacRecords\` ar1  ON piar1.almanacRecordID = ar1.ID ${yearClause('ar1')}
             JOIN \`almanacRecords\` ar2  ON ar2.instID = ar1.instID AND ar2.year = ar1.year
             JOIN \`personInAlmanacRecords\` piar2
               ON piar2.almanacRecordID = ar2.ID
              AND piar2.persID != :targetPersID
             WHERE piar1.persID = :targetPersID
             GROUP BY piar2.persID
             ORDER BY weight DESC`,
            { replacements, type: db.Sequelize.QueryTypes.SELECT }
        );

        const nodes = [
            {
                id: id,
                label: targetRows.name,
                isTarget: true,
                routeSegment: 'people',
                color: { border: '#551600', background: '#551600' },
                font: { color: '#ffffff', strokeColor: '#551600' },
                size: 30,
                borderWidth: 3
            },
            ...edges.map(row => ({
                id: row.persID,
                label: row.name,
                isTarget: false,
                routeSegment: 'people'
            }))
        ];

        const edgeList = edges.map(row => ({
            from: id,
            to: row.persID,
            weight: Number(row.weight),
            value: Number(row.weight),
            label: String(row.weight)
        }));

        // Find pairwise shared-institution counts among all neighbor people (excluding target)
        const neighborIDs = edges.map(row => row.persID);
        if (neighborIDs.length > 1) {
            const neighborEdges = await db.sequelize.query(
                `SELECT
                    piar1.persID AS persID1,
                    piar2.persID AS persID2,
                    COUNT(DISTINCT ar1.instID) AS weight
                 FROM \`personInAlmanacRecords\` piar1
                 JOIN \`almanacRecords\` ar1  ON piar1.almanacRecordID = ar1.ID ${yearClause('ar1')}
                 JOIN \`almanacRecords\` ar2  ON ar2.instID = ar1.instID AND ar2.year = ar1.year
                 JOIN \`personInAlmanacRecords\` piar2
                   ON piar2.almanacRecordID = ar2.ID
                  AND piar1.persID < piar2.persID
                 WHERE piar1.persID IN (:neighborIDs)
                   AND piar2.persID IN (:neighborIDs)
                 GROUP BY piar1.persID, piar2.persID
                 HAVING weight > 0`,
                { replacements: { ...replacements, neighborIDs }, type: db.Sequelize.QueryTypes.SELECT }
            );

            for (const row of neighborEdges) {
                edgeList.push({
                    from: row.persID1,
                    to: row.persID2,
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

exports.delete = (req, res) => {
    const id = req.params.persID;
    person.destroy({
        where: { persID: id }
    })
    .then(data => {
        if (!data) {
            res.status(404).send({
                message: `Cannot delete Person with id=${id}. Maybe Person was not found!`
            });
        } else {
            res.send({
                message: "Person was deleted successfully!"
            });
        }
    }).catch(err => {
        res.status(500).send({
            message: "Could not delete Person with id=" + id
        });
    });
};