import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TreeGraphComponent } from './tree-graph.component';

describe('TreeGraphComponent', () => {
  let component: TreeGraphComponent;
  let fixture: ComponentFixture<TreeGraphComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TreeGraphComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TreeGraphComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
