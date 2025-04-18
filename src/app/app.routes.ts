import { Routes } from '@angular/router';
import { HomeComponent } from './views/home/home.component';
export const routes: Routes = [
    { path: 'home', component: HomeComponent, pathMatch: 'full' },
    { path: '', component: HomeComponent, pathMatch: 'full' },
];
