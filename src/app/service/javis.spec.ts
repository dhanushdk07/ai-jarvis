import { TestBed } from '@angular/core/testing';

import { Javis } from './javis';

describe('Javis', () => {
  let service: Javis;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Javis);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
