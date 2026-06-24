import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PersonalNetworkComponent } from './personal-network.component';

describe('PersonalNetworkComponent', () => {
  let component: PersonalNetworkComponent;
  let fixture: ComponentFixture<PersonalNetworkComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonalNetworkComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PersonalNetworkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
