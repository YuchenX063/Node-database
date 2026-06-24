import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeHtml, Title } from '@angular/platform-browser';
import { marked } from 'marked';

interface FrontMatter {
  title?: string;
  description?: string;
  [key: string]: string | undefined;
}

@Component({
  selector: 'app-page',
  imports: [CommonModule],
  templateUrl: './page.component.html',
  styleUrl: './page.component.scss'
})
export class PageComponent implements OnInit {

  content: SafeHtml | null = null;
  loading = true;

  // Content files live in client/public/page-content/ and render at /pages/<slug>.
  // The folder is deliberately NOT named "pages": otherwise extensionless URLs like
  // /pages/foo can resolve to the raw foo.html file on some servers instead of the app.
  private readonly contentBase = 'page-content';

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private sanitizer: DomSanitizer,
    private title: Title,
  ) {}

  ngOnInit(): void {
    // Re-runs when navigating between pages, since the router reuses this component
    this.route.url.subscribe(segments => {
      const slug = segments.map(s => s.path).join('/') || 'index';
      this.loadPage(slug);
    });
  }

  private loadPage(slug: string): void {
    if (!this.isSafeSlug(slug)) {
      this.router.navigate(['/404']);
      return;
    }
    this.loading = true;
    this.content = null;

    this.fetch(`${slug}.md`).subscribe({
      next: text => this.isFallbackDocument(text) ? this.tryHtml(slug) : this.render(text, true),
      error: () => this.tryHtml(slug)
    });
  }

  private tryHtml(slug: string): void {
    this.fetch(`${slug}.html`).subscribe({
      next: text => this.isFallbackDocument(text)
        ? this.router.navigate(['/404'])
        : this.render(text, false),
      error: () => this.router.navigate(['/404'])
    });
  }

  // Hosts with a SPA fallback answer missing files with index.html and a 200
  // status. Content pages are body fragments, so a full document means "not found".
  private isFallbackDocument(raw: string): boolean {
    return /^\s*(<!doctype|<html)/i.test(raw);
  }

  private fetch(file: string) {
    return this.http.get(`${this.contentBase}/${file}`, { responseType: 'text' });
  }

  private render(raw: string, isMarkdown: boolean): void {
    const { meta, body } = this.extractFrontMatter(raw);
    const html = isMarkdown ? (marked.parse(body, { async: false }) as string) : body;

    // Page authors are trusted collaborators, so keep their markup intact
    this.content = this.sanitizer.bypassSecurityTrustHtml(html);
    this.loading = false;
    this.title.setTitle(meta.title ?? this.firstHeading(html) ?? 'Catholic Almanacs');
  }

  // Only allow simple relative paths like "history/jesuits-in-maine"
  private isSafeSlug(slug: string): boolean {
    return /^[\w\-/]+$/.test(slug) && !slug.includes('..');
  }

  // Parses an optional leading block of "key: value" lines between --- fences
  private extractFrontMatter(raw: string): { meta: FrontMatter, body: string } {
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (!match) return { meta: {}, body: raw };

    const meta: FrontMatter = {};
    for (const line of match[1].split(/\r?\n/)) {
      const separator = line.indexOf(':');
      if (separator > 0) {
        meta[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
      }
    }
    return { meta, body: raw.slice(match[0].length) };
  }

  private firstHeading(html: string): string | null {
    const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    return match ? match[1].replace(/<[^>]+>/g, '').trim() : null;
  }

  // Route internal links through the Angular router instead of a full page reload
  onContentClick(event: MouseEvent): void {
    const anchor = (event.target as HTMLElement).closest('a');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
    if (/^(https?:|mailto:|tel:|#)/.test(href)) return;

    event.preventDefault();
    this.router.navigateByUrl(href);
  }
}
