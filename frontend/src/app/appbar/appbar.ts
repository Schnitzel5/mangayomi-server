import { Component } from '@angular/core';
import {RouterLink} from "@angular/router";
import {Theme} from "../theme/theme";
import {NgIcon} from "@ng-icons/core";

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

}
