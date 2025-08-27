import { Routes } from '@angular/router';
import {Home} from "./home/home";
import {Register} from "./register/register";
import {Settings} from "./settings/settings";
import {Profile} from "./profile/profile";
import {Library} from "./library/library";
import {History} from "./history/history";
import {Updates} from "./updates/updates";
import {Tracking} from "./tracking/tracking";
import {NotFound} from "./not-found/not-found";

export const routes: Routes = [
    { path: 'web/**', redirectTo: '/web/home', pathMatch: 'full' },
    { path: 'web/home', component: Home },
    { path: 'web/register', component: Register },
    { path: 'web/profile', component: Profile },
    { path: 'web/settings', component: Settings },
    { path: 'web/library', component: Library},
    { path: 'web/history', component: History },
    { path: 'web/updates', component: Updates },
    { path: 'web/tracking', component: Tracking },
    { path: 'web/terms', component: NotFound },
];
