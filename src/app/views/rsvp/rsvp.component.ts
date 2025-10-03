import { Component, effect, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { Title } from '@angular/platform-browser';

/**
 * Response shape from /rsvp_info.php for a single RSVP code.
 */
interface RsvpInfoResponse {
    ok: boolean;
    code?: string;
    guest_names?: string[];
    attending_guest_names?: string[];
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
    guest_names?: string[];
    attending_guest_names?: string[];
    rsvp_response?: 'yes' | 'no' | 'pending';
    rsvped_at?: string | null;
    updated_at?: string | null;
    email_sent?: boolean;
    error?: string;
}

@Component({
    selector: 'app-rsvp',
    standalone: true,
    imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, MatSlideToggleModule, MatCheckboxModule],
    templateUrl: './rsvp.component.html',
    styleUrls: ['./rsvp.component.scss'],
})
/**
 * Route component for handling RSVP interactions at /rsvp/:code.
 *
 * Loads RSVP details by code and allows the user to submit a Yes/No response
 * that is sent to the backend endpoints.
 */
export class RsvpComponent implements OnInit {
    private _route = inject(ActivatedRoute);
    private _http = inject(HttpClient);
    private _titleService = inject(Title);

    protected readonly title = 'RSVP';

    ngOnInit(): void {
        this._titleService.setTitle(this.title);
    }

    /**
     * RSVP code extracted from the route param (uppercased) as a signal.
     */
    code = toSignal(this._route.paramMap.pipe(map((p) => (p.get('code') || '').toUpperCase())), {
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
     * Toggle state for marking that all listed guests are attending.
     */
    allComing = signal<boolean>(false);

    /**
     * Set of selected attending guests when not allComing.
     */
    selectedAttending = signal<Set<string>>(new Set<string>());

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
     * When info() updates, initialize selectedAttending from any existing attending_guest_names.
     */
    private readonly _initSelectionOnInfo = effect(() => {
        const i = this.info();
        const names = (i?.attending_guest_names ?? []) as string[];
        const set = new Set<string>();
        for (const n of names) set.add(n);
        this.selectedAttending.set(set);
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
        this._http.get(`/rsvp_info.php`, { params: { id }, responseType: 'text' }).subscribe({
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
     * @param namesCsv The names as comma-separated string, if applicable.
     */
    rsvp(response: 'yes' | 'no', namesCsv?: string) {
        if (this.submitting()) return;
        this.submitting.set(response);
        this.submitMessage.set(null);

        const id = this.code();
        const params: Record<string, string> = { id, response };

        if (response === 'yes') {
            const partySize = this.info()?.party_size ?? null;

            // Existing (optional) manual names CSV if present (kept for flexibility)
            const raw = (namesCsv || '').split(',');
            const parsed = raw
                .map((s) => s.trim())
                .filter((s) => s.length > 0);
            const limitedFromInput = typeof partySize === 'number' && partySize > 0 ? parsed.slice(0, partySize) : parsed;
            if (limitedFromInput.length > 0) {
                params['guest_names'] = JSON.stringify(limitedFromInput);
            }

            // Determine attending_guest_names based on toggle/selection and ALWAYS send it (even if empty)
            let attending: string[] = [];
            if (this.allComing()) {
                // All listed guests (capped by party size)
                const listed = (this.info()?.guest_names || []);
                attending = typeof partySize === 'number' && partySize > 0 ? listed.slice(0, partySize) : listed;
            } else {
                // Only the selected guests (capped by party size)
                const sel = Array.from(this.selectedAttending().values());
                attending = typeof partySize === 'number' && partySize > 0 ? sel.slice(0, partySize) : sel;
            }
            params['attending_guest_names'] = JSON.stringify(attending);
        }

        this._http.get(`/rsvp.php`, { params, responseType: 'text' }).subscribe({
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

    // UI helpers for checkbox selection
    isSelected(name: string): boolean {
        return this.selectedAttending().has(name);
    }

    toggleGuest(name: string, checked: boolean | undefined | null): void {
        const set = new Set(this.selectedAttending());
        if (checked) {
            set.add(name);
        } else {
            set.delete(name);
        }
        this.selectedAttending.set(set);
    }

    /**
     * Displayed party size logic:
     * - If allComing is ON, show the allowed/obtained party_size (fallback to invited count if null)
     * - If there is only one invited guest, show party_size (or 1 if party_size is null)
     * - If toggle is OFF, show the number of checked guests, capped by party_size if present
     */
    displayedPartySize = computed<number | null>(() => {
        const i = this.info();
        const ps = i?.party_size ?? null;
        const invited = i?.guest_names ?? [];
        const invitedCount = invited.length;

        // If all listed guests are attending OR only one invited guest
        if (this.allComing() || invitedCount === 1) {
            if (typeof ps === 'number' && ps > 0) {
                // show the allowed party size (obtained number)
                // also clamp to invited count if present
                return invitedCount > 0 ? Math.min(ps, invitedCount) : ps;
            }
            // fallback to invited count if party size is unknown
            return invitedCount > 0 ? invitedCount : null;
        }

        // Otherwise, toggle is OFF: show how many were checked off
        const selectedCount = this.selectedAttending().size;
        if (typeof ps === 'number' && ps > 0) {
            return Math.min(ps, selectedCount);
        }
        return selectedCount || null;
    });
}
