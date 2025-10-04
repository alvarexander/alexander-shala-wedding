import { Component, OnInit, inject, signal, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { ViewChild } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { PasswordDialogComponent } from './password-dialog.component';
import { FormControl, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Clipboard, ClipboardModule } from '@angular/cdk/clipboard';
import { Title } from '@angular/platform-browser';
import { MatTooltip } from '@angular/material/tooltip-module.d';

/**
 * Shape of a single invitation row displayed/edited in the Admin table.
 */
interface AdminRow {
    id: number;
    invite_code: string;
    guest_names: string[];
    attending_guest_names: string[];
    status: string;
    party_size: number | null;
    rsvped_at?: string | null;
    updated_at?: string | null;
}

/**
 * Response shape returned by /admin_list.php.
 */
interface AdminListResponse {
    ok: boolean;
    items: AdminRow[];
    statuses: { id: number; code: string; label: string }[];
}

@Component({
    selector: 'app-admin',
    standalone: true,
    imports: [
        CommonModule,
        HttpClientModule,
        MatTableModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatSelectModule,
        MatIconModule,
        MatSortModule,
        MatDialogModule,
        ReactiveFormsModule,
        FormsModule,
        MatSlideToggleModule,
        MatProgressSpinnerModule,
        MatSnackBarModule,
        ClipboardModule,
        MatTooltip,
    ],
    templateUrl: './admin.component.html',
    styleUrls: ['./admin.component.scss'],
})
/**
 * Admin view component that is gated by a simple password dialog.
 * Presents a Material table for viewing and editing invitation rows.
 */
export class AdminComponent implements OnInit, AfterViewInit {
    private readonly _http = inject(HttpClient);
    private readonly _dialog = inject(MatDialog);
    private readonly _router = inject(Router);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _clipboard = inject(Clipboard);
    private readonly _titleService = inject(Title);

    protected readonly title = 'Invitation Manager';

    /**
     * Columns displayed in the Material table.
     */
    displayedColumns = [
        'invite_code',
        'guest_names',
        'attending_guest_names',
        'status',
        'party_size',
    ];
    /** Data source feeding the mat-table (with paginator/sort integration). */
    dataSource = new MatTableDataSource<AdminRow>([]);

    /** Available statuses returned by the server for editing. */
    statuses: { id: number; code: string; label: string }[] = [];

    /** True while a list is being loaded from the server. */
    loading = signal(false);

    /** Row id currently being saved (used to disable the Save button). */
    savingId = signal<number | null>(null);

    /** Edit mode toggle (read-only by default). */
    editable = signal<boolean>(false);

    /** Global saving flag when saving all rows at once. */
    savingAll = signal<boolean>(false);

    /** Free-text filter bound to the table. */
    filterCtrl = new FormControl('');

    @ViewChild(MatSort) sort!: MatSort;

    /**
     * Initializes the admin page. Prompts for password if needed, then loads data.
     */
    ngOnInit(): void {
        const token = sessionStorage.getItem('admin_token');
        if (!token) {
            this.promptForPassword();
        } else {
            this.load();
        }

        this._titleService.setTitle(this.title);

        this.filterCtrl.valueChanges.subscribe((v) => {
            this.dataSource.filter = (v ?? '').trim().toLowerCase();
        });
        // Make filter include nested arrays by overriding filterPredicate
        this.dataSource.filterPredicate = (data, filter) => {
            const hay = [
                data.invite_code,
                data.status,
                String(data.party_size ?? ''),
                ...(data.guest_names || []),
                ...(data.attending_guest_names || []),
            ]
                .join(' ')
                .toLowerCase();
            return hay.includes(filter);
        };
    }

    /** Opens the password dialog and attempts authentication. */
    private promptForPassword(): void {
        const ref = this._dialog.open(PasswordDialogComponent, { disableClose: true });
        ref.afterClosed().subscribe((provided) => {
            if (!provided) {
                alert('Access denied');
                this._router.navigateByUrl('/');
                return;
            }
            // Verify the password with backend
            this._http
                .post<
                    { ok: boolean; token?: string } | { ok: false; error: string }
                >('/admin_auth.php', { password: provided })
                .subscribe({
                    next: (res: any) => {
                        if (!res || !res.ok || !res.token) {
                            alert('Access denied');
                            this._router.navigateByUrl('/');
                            return;
                        }
                        sessionStorage.setItem('admin_token', res.token as string);
                        this.load();
                    },
                    error: () => {
                        alert('Access denied');
                        this._router.navigateByUrl('/');
                    },
                });
        });
    }

    ngAfterViewInit(): void {
        // Defer to ensure the sort exists when initial load toggles the view
        setTimeout(() => {
            if (this.sort) this.dataSource.sort = this.sort;
        });
    }

    /** Loads all invitation rows and status options into the table. */
    load(): void {
        const token = sessionStorage.getItem('admin_token') || '';
        const headers = new HttpHeaders({ 'X-Admin-Token': token });
        this.loading.set(true);
        this._http.get<AdminListResponse>('/admin_list.php', { headers }).subscribe({
            next: (res) => {
                if (!res.ok) throw new Error('Failed to load');
                this.statuses = res.statuses;
                this.dataSource.data = res.items;
                if (this.sort) this.dataSource.sort = this.sort;
                this.loading.set(false);
            },
            error: (err) => {
                this.loading.set(false);
                if (err?.status === 401) {
                    // token invalid or missing – prompt again
                    sessionStorage.removeItem('admin_token');
                    this.promptForPassword();
                } else {
                    alert('Failed to load admin data');
                }
            },
        });
    }

    // Helpers to convert between arrays and CSV text
    /**
     * Converts a string array into a comma-separated string for inline editing.
     * @param arr Array of strings (may be null/undefined)
     * @returns CSV string (comma-space separated)
     */
    toCsv(arr: string[] | null | undefined): string {
        return (arr ?? []).join(', ');
    }

    /**
     * Parses a comma-separated string from the editor into a string array.
     * Trims whitespace and removes empty entries.
     * @param text CSV input
     * @returns Array of non-empty strings
     */
    fromCsv(text: string): string[] {
        return (text || '')
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
    }

    /**
     * Persists edits for a given row to the server via /admin_update.php.
     * If successful, updates the local table row in-place.
     * @param row The current row (source of truth for most fields)
     * @param edited Optional partial overrides to apply when sending
     */
    save(row: AdminRow, edited: Partial<AdminRow> = {}): void {
        const token = sessionStorage.getItem('admin_token') || '';
        const headers = new HttpHeaders({ 'X-Admin-Token': token });
        // Build payload with edited values (CSV inputs already bound into row via template refs)
        const payload: any = {
            id: row.id,
            invite_code: row.invite_code,
            party_size: row.party_size,
            status: row.status,
            guest_names: row.guest_names,
            attending_guest_names: row.attending_guest_names,
        };
        // Apply any overrides
        Object.assign(payload, edited);
        this.savingId.set(row.id);
        this._http.post('/admin_update.php', payload, { headers }).subscribe({
            next: (res: any) => {
                this.savingId.set(null);
                if (!res.ok) {
                    alert('Save failed');
                    return;
                }
                // Update the row in-place
                const idx = this.dataSource.data.findIndex((r) => r.id === row.id);
                if (idx >= 0) {
                    this.dataSource.data[idx] = res.item as AdminRow;
                    this.dataSource._updateChangeSubscription();
                }
            },
            error: (err) => {
                this.savingId.set(null);
                if (err?.status === 401) {
                    sessionStorage.removeItem('admin_token');
                    alert('Your session expired. Please re-authenticate.');
                    this.promptForPassword();
                } else {
                    alert('Save failed');
                }
            },
        });
    }

    /** Saves all rows currently in the table (best-effort, sequentially). */
    async saveAll(): Promise<void> {
        if (this.savingAll()) return;
        const token = sessionStorage.getItem('admin_token') || '';
        const headers = new HttpHeaders({ 'X-Admin-Token': token });
        const rows = this.dataSource.data;
        if (!rows || rows.length === 0) return;

        this.savingAll.set(true);
        try {
            for (const row of rows) {
                const payload: any = {
                    id: row.id,
                    invite_code: row.invite_code,
                    party_size: row.party_size,
                    status: row.status,
                    guest_names: row.guest_names,
                    attending_guest_names: row.attending_guest_names,
                };
                await new Promise<void>((resolve) => {
                    this._http.post('/admin_update.php', payload, { headers }).subscribe({
                        next: (res: any) => {
                            if (res?.ok && res.item) {
                                const idx = this.dataSource.data.findIndex((r) => r.id === row.id);
                                if (idx >= 0) {
                                    this.dataSource.data[idx] = res.item as AdminRow;
                                    this.dataSource._updateChangeSubscription();
                                }
                            }
                            resolve();
                        },
                        error: () => resolve(), // continue best-effort on error
                    });
                });
            }
            this._snackBar.open('All changes saved', undefined, { duration: 2000 });
        } finally {
            this.savingAll.set(false);
        }
    }

    /** Reloads the table from the server, discarding any unsaved edits. */
    reset(): void {
        // Reload all data (simplest minimal approach)
        this.load();
    }

    /** Reset via floating action button (alias to reset). */
    resetAll(): void {
        this.reset();
    }

    /**
     * Resolves a human-friendly status label from a status code.
     */
    statusLabel(code: string): string {
        const found = this.statuses.find((s) => s.code === code);
        return found?.label || code;
    }

    /** Copies the row's invite code to clipboard and shows a confirmation snackbar. */
    copyInvite(row: AdminRow): void {
        const ok = this._clipboard.copy(row.invite_code);
        if (ok) {
            this._snackBar.open('Invite code copied', undefined, { duration: 2000 });
        } else {
            // Fallback attempt using navigator if available
            if (navigator && 'clipboard' in navigator && (navigator as any)._clipboard?.writeText) {
                (navigator as any)._clipboard
                    .writeText(row.invite_code)
                    .then(() =>
                        this._snackBar.open('Invite code copied', undefined, { duration: 2000 }),
                    )
                    .catch(() =>
                        this._snackBar.open('Failed to copy', undefined, { duration: 2000 }),
                    );
            } else {
                this._snackBar.open('Failed to copy', undefined, { duration: 2000 });
            }
        }
    }
}
