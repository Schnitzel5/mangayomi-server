import { Routes } from '@angular/router';
import {Home} from "./home/home";
import {Register} from "./register/register";
import {Settings} from "./settings/settings";
import {NotFound} from "./not-found/not-found";
import {Profile} from "./profile/profile";
import {Library} from "./library/library";
import {History} from "./history/history";
import {Updates} from "./updates/updates";
import {Tracking} from "./tracking/tracking";

export const routes: Routes = [
    { path: '', redirectTo: '/home', pathMatch: 'full' },
    { path: 'home', component: Home },
    { path: 'register', component: Register },
    { path: 'profile', component: Profile },
    { path: 'settings', component: Settings },
    { path: 'library', component: Library},
    { path: 'history', component: History },
    { path: 'updates', component: Updates },
    { path: 'tracking', component: Tracking },
    { path: '**', component: NotFound }
];
