import { Component, signal } from '@angular/core';
import {Router, RouterOutlet} from '@angular/router';
import {Theme} from "./theme/theme";
import {Appbar} from "./appbar/appbar";
import {Footer} from "./footer/footer";
import {AuthService} from "../service/auth";

@Component({
  selector: 'app-root',
    imports: [RouterOutlet, Theme, Appbar, Footer],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  constructor(private router: Router, private auth: AuthService) {
    if (!auth.isLoggedIn()) {
      router.navigate(['/web/register']);
    }
  }
}
