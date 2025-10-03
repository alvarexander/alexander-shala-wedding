import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { ViewChild } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { PasswordDialogComponent } from './password-dialog.component';
import { FormControl, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

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
        MatPaginatorModule,
        MatSortModule,
        MatDialogModule,
        ReactiveFormsModule,
        FormsModule,
        MatSlideToggleModule,
    ],
    templateUrl: './admin.component.html',
    styleUrls: ['./admin.component.scss'],
})
/**
 * Admin view component that is gated by a simple password dialog.
 * Presents a Material table for viewing and editing invitation rows.
 */
export class AdminComponent implements OnInit {
    private http = inject(HttpClient);
    private dialog = inject(MatDialog);
    private router = inject(Router);

    /**
     * Columns displayed in the Material table.
     */
    displayedColumns = [
        'invite_code',
        'guest_names',
        'attending_guest_names',
        'status',
        'party_size',
        'actions',
    ];
    /** Data source feeding the mat-table (with paginator/sort integration). */
    dataSource = new MatTableDataSource<AdminRow>([]);
    /** Available statuses returned by the server for editing. */
    statuses: { id: number; code: string; label: string }[] = [];
    /** True while list is being loaded from the server. */
    loading = signal(false);
    /** Row id currently being saved (used to disable Save button). */
    savingId = signal<number | null>(null);

    /** Edit mode toggle (read-only by default). */
    editable = signal<boolean>(false);

    /** Free-text filter bound to the table. */
    filterCtrl = new FormControl('');

    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild(MatSort) sort!: MatSort;

    /**
     * Initializes the admin page. Prompts for password if needed, then loads data.
     */
    ngOnInit(): void {
        const passOk = sessionStorage.getItem('admin_pass_ok') === '1';
        if (!passOk) {
            const ref = this.dialog.open(PasswordDialogComponent, { disableClose: true });
            ref.afterClosed().subscribe((provided) => {
                if (provided !== 'password') {
                    alert('Access denied');
                    this.router.navigateByUrl('/');
                    return;
                }
                sessionStorage.setItem('admin_pass_ok', '1');
                this.load();
            });
        } else {
            this.load();
        }

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

    /** Loads all invitation rows and status options into the table. */
    load(): void {
        this.loading.set(true);
        this.http.get<AdminListResponse>('/admin_list.php').subscribe({
            next: (res) => {
                if (!res.ok) throw new Error('Failed to load');
                this.statuses = res.statuses;
                this.dataSource = new MatTableDataSource(res.items);
                if (this.paginator) this.dataSource.paginator = this.paginator;
                if (this.sort) this.dataSource.sort = this.sort;
                this.loading.set(false);
            },
            error: () => {
                this.loading.set(false);
                alert('Failed to load admin data');
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
        this.http.post('/admin_update.php', payload).subscribe({
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
            error: () => {
                this.savingId.set(null);
                alert('Save failed');
            },
        });
    }

    /** Reloads the table from the server, discarding any unsaved edits. */
    reset(): void {
        // Reload all data (simplest minimal approach)
        this.load();
    }

    /**
     * Resolves a human-friendly status label from a status code.
     */
    statusLabel(code: string): string {
        const found = this.statuses.find((s) => s.code === code);
        return found?.label || code;
    }
}
