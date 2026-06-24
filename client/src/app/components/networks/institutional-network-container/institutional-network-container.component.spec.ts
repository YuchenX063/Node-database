import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InstitutionalNetworkContainerComponent } from './institutional-network-container.component';

describe('InstitutionalNetworkContainerComponent', () => {
  let component: InstitutionalNetworkContainerComponent;
  let fixture: ComponentFixture<InstitutionalNetworkContainerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InstitutionalNetworkContainerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InstitutionalNetworkContainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
