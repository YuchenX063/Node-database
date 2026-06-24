import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { CoverageComponent } from './coverage.component';

describe('CoverageComponent', () => {
  let component: CoverageComponent;
  let fixture: ComponentFixture<CoverageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CoverageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();

    fixture = TestBed.createComponent(CoverageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
