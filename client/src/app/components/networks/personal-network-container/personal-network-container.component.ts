import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PersonalNetworkComponent } from './personal-network/personal-network.component';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';


@Component({
  selector: 'app-personal-network-container',
  imports: [PersonalNetworkComponent, MatButtonModule, MatIconModule],
  templateUrl: './personal-network-container.component.html',
  styleUrl: './personal-network-container.component.scss'
})
export class PersonalNetworkContainerComponent {
  comparisonNetwork: boolean = false;

  toggleComparisonNetwork() {
    this.comparisonNetwork = !this.comparisonNetwork;
  }

}
