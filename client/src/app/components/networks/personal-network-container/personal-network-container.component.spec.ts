import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PersonalNetworkContainerComponent } from './personal-network-container.component';

describe('PersonalNetworkContainerComponent', () => {
  let component: PersonalNetworkContainerComponent;
  let fixture: ComponentFixture<PersonalNetworkContainerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonalNetworkContainerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PersonalNetworkContainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
