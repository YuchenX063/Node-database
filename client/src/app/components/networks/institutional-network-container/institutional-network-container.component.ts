import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InstitutionalNetworkComponent } from "./institutional-network/institutional-network.component";

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-institutional-network-container',
  imports: [InstitutionalNetworkComponent, MatButtonModule, MatIconModule],
  templateUrl: './institutional-network-container.component.html',
  styleUrl: './institutional-network-container.component.scss'
})
export class InstitutionalNetworkContainerComponent {
  comparisonNetwork: boolean = false;

  toggleComparisonNetwork() {
    this.comparisonNetwork = !this.comparisonNetwork;
  }

}
