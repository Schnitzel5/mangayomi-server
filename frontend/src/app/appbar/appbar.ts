import { Component } from '@angular/core';
import {RouterLink} from "@angular/router";
import {Theme} from "../theme/theme";
import {NgIcon} from "@ng-icons/core";
import {AuthService} from "../../service/auth";

@Component({
  selector: 'app-appbar',
    imports: [
        RouterLink,
        Theme,
        NgIcon
    ],
  templateUrl: './appbar.html',
  styleUrl: './appbar.scss'
})
export class Appbar {
    constructor(private auth: AuthService) {
    }

    isLogged(): boolean {
        return this.auth.isLoggedIn();
    }

    logout() {
        this.auth.logout();
    }
}
