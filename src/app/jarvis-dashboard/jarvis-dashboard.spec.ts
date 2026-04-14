import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JarvisDashboard } from './jarvis-dashboard';

describe('JarvisDashboard', () => {
  let component: JarvisDashboard;
  let fixture: ComponentFixture<JarvisDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JarvisDashboard],
    }).compileComponents();

    fixture = TestBed.createComponent(JarvisDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
