import { Routes } from '@angular/router';
import { HomeComponent } from './views/home/home.component';
import { OurStoryComponent } from './views/our-story/our-story.component';
import { QuestionsAndAnswersComponent } from './views/questions-and-answers/questions-and-answers.component';
import { RegistryComponent } from './views/registry/registry.component';
import { GalleryComponent } from './views/gallery/gallery.component';
import { RsvpComponent } from './views/rsvsp/rsvp.component';

export const routes: Routes = [
    { path: 'home', component: HomeComponent, pathMatch: 'full' },
    { path: 'our-story', component: OurStoryComponent, pathMatch: 'full' },
    {
        path: 'questions-and-answers',
        component: QuestionsAndAnswersComponent,
        pathMatch: 'full',
    },
    { path: 'registry', component: RegistryComponent, pathMatch: 'full' },
    { path: '', component: HomeComponent, pathMatch: 'full' },
    { path: 'gallery', component: GalleryComponent, pathMatch: 'full' },
    { path: 'rsvp/:code', component: RsvpComponent, pathMatch: 'full' },
];
