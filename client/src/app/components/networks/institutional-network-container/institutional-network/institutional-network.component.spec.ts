import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InstitutionalNetworkComponent } from './institutional-network.component';

describe('InstitutionalNetworkComponent', () => {
  let component: InstitutionalNetworkComponent;
  let fixture: ComponentFixture<InstitutionalNetworkComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InstitutionalNetworkComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InstitutionalNetworkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
