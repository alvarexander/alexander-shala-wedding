import { Routes } from '@angular/router';
import { HomeComponent } from './views/home/home.component';
import { OurStoryComponent } from './views/our-story/our-story.component';
import { QuestionsAndAnswersComponent } from './views/questions-and-answers/questions-and-answers.component';
import { GalleryComponent } from './views/gallery/gallery.component';
import { RsvpComponent } from './views/rsvp/rsvp.component';
import { AdminComponent } from './views/admin/admin.component';

export const routes: Routes = [
    { path: 'home', component: HomeComponent, pathMatch: 'full' },
    { path: 'our-story', component: OurStoryComponent, pathMatch: 'full' },
    {
        path: 'questions-and-answers',
        component: QuestionsAndAnswersComponent,
        pathMatch: 'full',
    },
    { path: '', component: HomeComponent, pathMatch: 'full' },
    { path: 'gallery', component: GalleryComponent, pathMatch: 'full' },
    { path: 'rsvp/:code', component: RsvpComponent, pathMatch: 'full' },
    { path: 'admin', component: AdminComponent, pathMatch: 'full' },
];
