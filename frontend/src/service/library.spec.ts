import { TestBed } from '@angular/core/testing';

import { Library } from './library';

describe('Library', () => {
  let service: Library;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Library);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
