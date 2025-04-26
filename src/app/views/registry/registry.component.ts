import { Component } from '@angular/core';
import {
    MatCard,
    MatCardActions,
    MatCardContent,
    MatCardHeader,
    MatCardImage,
    MatCardSubtitle,
    MatCardTitle,
} from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { MatButton } from '@angular/material/button';

@Component({
    selector: 'app-registry',
    imports: [
        MatCard,
        MatIcon,
        MatButton,
        MatCardTitle,
        MatCardSubtitle,
        MatCardHeader,
        MatCardActions,
        MatCardContent,
        MatCardImage,
    ],
    templateUrl: './registry.component.html',
    styleUrl: './registry.component.scss',
})
export class RegistryComponent {
    /**
     * Toolbar title
     */
    protected readonly title = 'Registries';

    /**
     * Walmart registry URL
     */
    private readonly W_REGISTRY =
        'https://www.walmart.com/registry/explore?listRegistryId=6ea23e78-5b5d-46cb-9d45-6b15f7181418&listRegistryType=WR';

    /**
     * Target registry URL
     */
    private readonly T_REGISTRY =
        'https://www.target.com/gift-registry/gift-giver?registryId=64c1eb90-1ca4-11f0-90a8-d7d92f946a09&type=WEDDING';

    /**
     * Amazon registry URL
     */
    private readonly A_REGISTRY =
        'https://www.amazon.com/wedding/organize-registry?ref_=gr-home-wedding-viewyr';

    /**
     * Opens link to registry
     * @param store The name of the store
     */
    openLink(store: string): void {
        switch (store) {
            case 'Walmart':
                window.open(this.W_REGISTRY, '_blank');
                break;
            case 'Target':
                window.open(this.T_REGISTRY, '_blank');
                break;
            case 'Amazon':
                window.open(this.A_REGISTRY, '_blank');
                break;
            default:
                break;
        }
    }

    /**
     * Opens share sheet to share registry
     * @param store The name of the store
     */
    shareLink(store: string) {
        let url = '';
        switch (store) {
            case 'Walmart':
                url = this.W_REGISTRY;
                break;
            case 'Target':
                url = this.T_REGISTRY;
                break;
            case 'Amazon':
                url = this.A_REGISTRY;
                break;
            default:
                break;
        }
        if (navigator.share) {
            navigator
                .share({
                    url: url,
                    text: `Alexander & Shala's ${store} Registry`,
                })
                .then(() => {
                    console.log('Successfully shared');
                })
                .catch(error => {
                    console.error('Error sharing:', error);
                });
        }
    }
}
