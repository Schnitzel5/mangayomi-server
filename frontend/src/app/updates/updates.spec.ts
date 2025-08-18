import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Updates } from './updates';

describe('Updates', () => {
  let component: Updates;
  let fixture: ComponentFixture<Updates>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Updates]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Updates);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
