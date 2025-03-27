import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-test',
  imports: [],
  templateUrl: './test.component.html',
  styleUrl: './test.component.scss'
})
export class TestComponent {
  @Input() message: string = 'Hello test!';
  @Output() itemClicked = new EventEmitter();

  buttonClick() {
    this.itemClicked.emit({
      testMessage: 'event emitted!!'
    })
  };
}
