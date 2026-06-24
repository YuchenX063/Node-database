import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  ElementRef,
  ViewChild,
  AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';

export interface DendrogramNode {
  name: string;
  instID: string;
  year: number | null;
  children?: DendrogramNode[];
}

// Internal d3 node type that holds collapsed state
interface D3Node extends d3.HierarchyNode<DendrogramNode> {
  _children?: this['children'];
  x0?: number;
  y0?: number;
}

@Component({
  selector: 'app-tree-graph',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tree-graph.component.html',
  styleUrl: './tree-graph.component.scss'
})
export class TreeGraphComponent implements AfterViewInit, OnChanges {
  @ViewChild('svgContainer', { static: false }) svgContainer!: ElementRef<HTMLDivElement>;

  @Input() data: DendrogramNode | null = null;
  @Input() label: string = '';
  @Output() nodeDoubleClick = new EventEmitter<DendrogramNode>();

  private isViewInitialized = false;
  private svg: any = null;
  private g: any = null;
  private root: any = null;

  private readonly nodeRadius = 6;
  private readonly nodeSpacingX = 200;
  private readonly nodeSpacingY = 32;
  private readonly duration = 300;
  private readonly marginTop = 20;
  private readonly marginBottom = 20;
  private readonly marginLeft = 20;
  private readonly marginRight = 240;

  ngAfterViewInit(): void {
    this.isViewInitialized = true;
    if (this.data) {
      this.init();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && this.isViewInitialized) {
      this.init();
    }
  }

  private init(): void {
    if (!this.data || !this.svgContainer) return;

    const container = this.svgContainer.nativeElement;
    d3.select(container).selectAll('*').remove();

    this.root = d3.hierarchy(this.data) as D3Node;
    this.root.x0 = 0;
    this.root.y0 = 0;

    // SVG grows to fit; start with a reasonable height estimate
    this.svg = d3.select(container)
      .append('svg')
      .style('width', '100%')
      .style('overflow', 'visible');

    this.g = this.svg.append('g')
      .attr('transform', `translate(${this.marginLeft},${this.marginTop})`);

    this.update(this.root);
  }

  private update(source: D3Node): void {
    const treeLayout = d3.tree<DendrogramNode>()
      .nodeSize([this.nodeSpacingY, this.nodeSpacingX]);

    treeLayout(this.root);

    const nodes: D3Node[] = this.root.descendants() as D3Node[];
    const links = this.root.links();

    // Shift all nodes so the topmost is at y=0
    let minX = Infinity;
    nodes.forEach(d => { if (d.x! < minX) minX = d.x!; });
    nodes.forEach(d => { d.x! ; (d as any).x -= minX; });

    // Resize SVG to fit current tree
    let maxX = -Infinity;
    let maxY = -Infinity;
    nodes.forEach(d => {
      if ((d as any).x > maxX) maxX = (d as any).x;
      if (d.y! > maxY) maxY = d.y!;
    });
    const svgHeight = maxX + this.marginTop + this.marginBottom;
    const svgWidth = maxY + this.marginLeft + this.marginRight;
    this.svg
      .attr('height', svgHeight)
      .attr('width', svgWidth);

    const linkGen = d3.linkHorizontal<any, any>()
      .x((d: any) => d.y)
      .y((d: any) => d.x);

    // ── Links ────────────────────────────────────────────────────────────────
    const link = this.g.selectAll('path.link')
      .data(links, (d: any) => d.target.data.instID);

    const linkEnter = link.enter()
      .append('path')
      .attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke', '#aaa')
      .attr('stroke-width', 1.5)
      .attr('d', () => {
        const o = { x: source.x0 ?? 0, y: source.y0 ?? 0 };
        return linkGen({ source: o, target: o });
      });

    linkEnter.merge(link)
      .transition().duration(this.duration)
      .attr('d', linkGen);

    link.exit()
      .transition().duration(this.duration)
      .attr('d', () => {
        const o = { x: source.x!, y: source.y! };
        return linkGen({ source: o, target: o });
      })
      .remove();

    // ── Nodes ────────────────────────────────────────────────────────────────
    const node = this.g.selectAll('g.node')
      .data(nodes, (d: any) => d.data.instID);

    const nodeEnter = node.enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', () => `translate(${source.y0 ?? 0},${source.x0 ?? 0})`)
      .style('cursor', 'pointer')
      .on('click', (_event: MouseEvent, d: D3Node) => this.toggle(d))
      .on('dblclick', (_event: MouseEvent, d: D3Node) => {
        _event.stopPropagation();
        this.nodeDoubleClick.emit(d.data);
      });

    nodeEnter.append('circle')
      .attr('r', 0)
      .attr('stroke', '#003B1F')
      .attr('stroke-width', 1.5);

    nodeEnter.append('text')
      .attr('dy', '0.31em')
      .style('font-size', '12px')
      .style('font-family', 'sans-serif')
      .style('user-select', 'none')
      .attr('opacity', 0);

    const nodeMerge = nodeEnter.merge(node);

    nodeMerge.transition().duration(this.duration)
      .attr('transform', (d: any) => `translate(${d.y},${d.x})`);

    nodeMerge.select('circle')
      .transition().duration(this.duration)
      .attr('r', this.nodeRadius)
      .attr('fill', (d: D3Node) => d._children ? '#888' : (d.children ? '#003B1F' : '#6aab8e'));

    nodeMerge.select('text')
      .transition().duration(this.duration)
      .attr('opacity', 1)
      .attr('x', (d: D3Node) => (d.children && d.depth > 0) ? -(this.nodeRadius + 4) : (this.nodeRadius + 4))
      .attr('text-anchor', (d: D3Node) => (d.children && d.depth > 0) ? 'end' : 'start')
      .text((d: D3Node) => d.data.name + (d.data.year ? ` (${d.data.year})` : ''));

    node.exit()
      .transition().duration(this.duration)
      .attr('transform', `translate(${source.y!},${source.x!})`)
      .style('opacity', 0)
      .remove();

    // Save positions for next transition origin
    nodes.forEach((d: any) => { d.x0 = d.x; d.y0 = d.y; });
  }

  private toggle(d: D3Node): void {
    if (d.children) {
      d._children = d.children;
      d.children = undefined;
    } else if (d._children) {
      d.children = d._children;
      d._children = undefined;
    } else {
      return; // leaf — nothing to toggle
    }
    this.update(d);
  }
}
