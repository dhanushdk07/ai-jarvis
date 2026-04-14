import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { JarvisDashboard } from './jarvis-dashboard/jarvis-dashboard';

@Component({
  selector: 'app-root',
  imports: [FormsModule, CommonModule, JarvisDashboard],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
