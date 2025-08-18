import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Theme } from './theme';

describe('Theme', () => {
  let component: Theme;
  let fixture: ComponentFixture<Theme>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Theme]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Theme);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
