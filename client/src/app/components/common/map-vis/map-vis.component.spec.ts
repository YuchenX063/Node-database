import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MapVisComponent } from './map-vis.component';

describe('MapVisComponent', () => {
  let component: MapVisComponent;
  let fixture: ComponentFixture<MapVisComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapVisComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MapVisComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
