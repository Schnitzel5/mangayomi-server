import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {Theme} from "./theme/theme";
import {Appbar} from "./appbar/appbar";
import {Footer} from "./footer/footer";

@Component({
  selector: 'app-root',
    imports: [RouterOutlet, Theme, Appbar, Footer],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('frontend');
}
