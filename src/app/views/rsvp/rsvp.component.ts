import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

/**
 * Response shape from /rsvp_info.php for a single RSVP code.
 */
interface RsvpInfoResponse {
    ok: boolean;
    code?: string;
    guest_name?: string | null;
    party_size?: number | null;
    rsvp_response?: 'pending' | 'yes' | 'no';
    rsvped_at?: string | null;
    updated_at?: string | null;
    error?: string;
}

/**
 * Response shape from /rsvp.php when recording/checking an RSVP.
 */
interface RsvpUpdateResponse {
    ok: boolean;
    message?: string;
    code?: string;
    guest_name?: string | null;
    rsvp_response?: 'yes' | 'no' | 'pending';
    rsvped_at?: string | null;
    updated_at?: string | null;
    email_sent?: boolean;
    error?: string;
}

@Component({
    selector: 'app-rsvp',
    standalone: true,
    imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
    templateUrl: './rsvp.component.html',
    styleUrls: ['./rsvp.component.scss'],
})
/**
 * Route component for handling RSVP interactions at /rsvp/:code.
 *
 * Loads RSVP details by code and allows the user to submit a Yes/No response
 * that is sent to the backend endpoints.
 */
export class RsvpComponent {
    private route = inject(ActivatedRoute);
    private http = inject(HttpClient);

    /**
     * Safely parses a JSON string, returning null if parsing fails.
     */
    private _parseJsonSafe<T>(txt: string): T | null {
        try {
            return JSON.parse(txt) as T;
        } catch {
            return null;
        }
    }

    /**
     * Generates a helpful hint when a non-JSON payload is received.
     * Detects common cases like raw PHP served or HTML pages.
     */
    private _deriveNonJsonHint(sample: string): string {
        const trimmed = (sample || '').trimStart();
        if (trimmed.startsWith('<?php')) {
            return 'Unable to obtain RSVP date at this time. Please try again later.';
        }
        if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')) {
            return 'Unable to obtain RSVP date at this time. Please try again later.';
        }
        if (!trimmed) {
            return 'Received an empty response.';
        }
        return 'Unexpected response format from the server.';
    }

    /**
     * RSVP code extracted from the route param (uppercased) as a signal.
     */
    code = toSignal(this.route.paramMap.pipe(map((p) => (p.get('code') || '').toUpperCase())), {
        initialValue: '',
    });

    /**
     * True while loading RSVP information from the server.
     */
    loading = signal<boolean>(true);

    /**
     * Error message when a request fails; null if no error.
     */
    error = signal<string | null>(null);

    /**
     * Latest fetched RSVP info for the current code.
     */
    info = signal<RsvpInfoResponse | null>(null);

    /**
     * Current submission state; set to the response being submitted or null when idle.
     */
    submitting = signal<'yes' | 'no' | null>(null);

    /**
     * Human-friendly message reflecting the submission outcome.
     */
    submitMessage = signal<string | null>(null);

    /**
     * React to changes in the code and fetch info automatically.
     */
    private readonly _loadOnCodeChange = effect(() => {
        const current = this.code();
        if (current) {
            this.fetchInfo();
        }
    });

    /**
     * Fetches RSVP info for the current code from the backend.
     * Updates loading/error/info state accordingly.
     */
    fetchInfo() {
        this.loading.set(true);
        this.error.set(null);
        this.submitMessage.set(null);
        const id = this.code();
        this.http.get(`/rsvp_info.php`, { params: { id }, responseType: 'text' }).subscribe({
            next: (txt) => {
                const res = this._parseJsonSafe<RsvpInfoResponse>(txt);
                if (!res) {
                    const hint = this._deriveNonJsonHint(txt);
                    this.error.set(`The server did not respond. ${hint}`);
                    this.info.set(null);
                } else if (!res.ok) {
                    this.error.set(res.error || 'Failed to load RSVP info.');
                    this.info.set(null);
                } else {
                    this.info.set(res);
                }
                this.loading.set(false);
            },
            error: (err) => {
                this.error.set(err?.error?.error || 'Failed to load RSVP info.');
                this.loading.set(false);
            },
        });
    }

    /**
     * Submits an RSVP response for the current code.
     * @param response The user's response: 'yes' or 'no'.
     */
    rsvp(response: 'yes' | 'no') {
        if (this.submitting()) return;
        this.submitting.set(response);
        this.submitMessage.set(null);

        const id = this.code();
        this.http.get(`/rsvp.php`, { params: { id, response }, responseType: 'text' }).subscribe({
            next: (txt) => {
                const res = this._parseJsonSafe<RsvpUpdateResponse>(txt);
                if (res && res.ok) {
                    this.submitMessage.set(
                        `RSVP recorded as ${res.rsvp_response?.toUpperCase()}. Thank you!`,
                    );
                    // Refresh info to reflect updates
                    this.fetchInfo();
                } else if (res) {
                    this.submitMessage.set(res.error || 'Failed to submit RSVP.');
                } else {
                    const hint = this._deriveNonJsonHint(txt);
                    this.submitMessage.set(
                        `The server did not return valid JSON for RSVP submit. ${hint}`,
                    );
                }
                this.submitting.set(null);
            },
            error: (err) => {
                this.submitMessage.set(err?.error?.error || 'Failed to submit RSVP.');
                this.submitting.set(null);
            },
        });
    }
}
