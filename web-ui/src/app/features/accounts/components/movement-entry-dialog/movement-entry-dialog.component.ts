import { ChangeDetectionStrategy, Component, DestroyRef, inject, Inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ApiErrorDto, EntryDataDto, EntryItemDataDto } from '@famoney-apis/accounts';
import { EntryItemFormGroup, EntryItemService } from '@famoney-features/accounts/components/entry-item';
import { AccountEntry, EntryItem } from '@famoney-features/accounts/models/account-entry.model';
import { ReactiveFormErrorHandlerService } from '@famoney-shared/services/reactive-form-error-handler.service';
import { EntryCategoriesFacade } from '@famoney-shared/stores/entry-categories/entry-categories.facade';
import { FlatEntryCategory } from '@famoney-shared/stores/entry-categories/entry-categories.state';
import { NotifierService } from 'angular-notifier';
import { mergeWith, of } from 'rxjs';
import { filter, map, switchMap } from 'rxjs/operators';

@Component({
  selector: 'fm-movement-entry-dialog',
  templateUrl: 'movement-entry-dialog.component.html',
  styleUrls: ['movement-entry-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovementEntryDialogComponent {
  private formBuilder = inject(NonNullableFormBuilder);
  private errorHandlerService = inject(ReactiveFormErrorHandlerService);

  readonly entryForm = this.formBuilder.group({
    movementDate: this.formBuilder.group({
      date: this.formBuilder.control(new Date(), [Validators.required]),
      bookingDate: this.formBuilder.control<Date | undefined>({
        value: undefined,
        disabled: false,
      }),
      budgetPeriod: this.formBuilder.control<Date | undefined>({
        value: undefined,
        disabled: false,
      }),
    }),
    entryItems: this.formBuilder.array<EntryItemFormGroup>([]),
  });
  readonly entryDateError$ = this.errorHandlerService.provideErrorHandler$(
    this.entryForm.controls.movementDate.controls.date,
    'accounts.entryDialog.fields.entryDate.errors',
  );
  cumulatedSum = signal<number | undefined>(undefined);
  loaded = signal<boolean>(false);
  extendedDate = signal<'extended-date' | undefined>(undefined);
  extendedEntry = signal<'extended-entry' | undefined>(undefined);

  constructor(
    private dialogRef: MatDialogRef<MovementEntryDialogComponent, EntryDataDto>,
    private entryCategoriesFacade: EntryCategoriesFacade,
    private notifierService: NotifierService,
    @Inject(MAT_DIALOG_DATA) private data: EntryDataDto,
    private entryItemService: EntryItemService,
    destroyRef: DestroyRef,
  ) {
    this.dialogRef
      .keydownEvents()
      .pipe(
        filter((event) => event.key === 'Escape'),
        mergeWith(this.dialogRef.backdropClick()),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(() => this.close());
    of(this.data)
      .pipe(
        switchMap((entryData) =>
          this.entryCategoriesFacade.entryCategories$.pipe(
            map((entryCategories) => {
              const accountEntry: AccountEntry = {
                movementDate: {
                  date: entryData?.date ?? new Date(),
                  bookingDate: entryData?.bookingDate,
                  budgetPeriod: entryData?.budgetPeriod,
                },
                entryItems: entryData
                  ? entryData.entryItems.map((entryItem) =>
                      this.createEntryItem(entryItem, entryCategories?.flatEntryCategories.get(entryItem.categoryId)),
                    )
                  : [this.createEntryItem()],
              };
              return accountEntry;
            }),
          ),
        ),
      )
      .subscribe((accountEntry) => {
        const {
          entryItems,
          movementDate: { bookingDate, budgetPeriod },
        } = accountEntry;
        this.extendedDate.set(bookingDate || budgetPeriod ? 'extended-date' : undefined);
        this.extendedEntry.set(entryItems.length > 1 ? 'extended-entry' : undefined);
        const entryItemControls = entryItems.map(() => this.entryItemService.createEntryItemFormGroup());
        this.entryForm.setControl('entryItems', this.formBuilder.array(entryItemControls));
        this.entryForm.patchValue(accountEntry);
        this.loaded.set(true);
      });
  }

  private createEntryItem(entryItem?: EntryItemDataDto, flatEntryCategory?: FlatEntryCategory): EntryItem {
    const entryItemAmount = entryItem?.amount;
    const sign = flatEntryCategory?.sign;
    const amount = entryItemAmount && sign ? entryItemAmount * sign : 0;
    return {
      categoryId: entryItem?.categoryId ?? 0,
      amount: amount,
      comments: entryItem?.comments,
    };
  }

  close() {
    this.dialogRef.close();
  }

  addEntryItem() {
    this.entryForm.controls.entryItems.push(this.entryItemService.createEntryItemFormGroup());
  }

  deleteEntryItem(entryItemIndex: number) {
    this.entryForm.controls.entryItems.removeAt(entryItemIndex);
  }

  save() {
    of(this.entryForm?.value)
      .pipe(
        switchMap((accountEntry) =>
          this.entryCategoriesFacade.entryCategories$.pipe(
            map((entryCategories) => [accountEntry, entryCategories] as const),
          ),
        ),
        map(([accountEntry, entryCategories]) => {
          const entryItems =
            accountEntry.entryItems?.map((entryItem) => {
              const categoryId = typeof entryItem?.categoryId === 'number' ? entryItem?.categoryId : 0;
              const entryCategory = entryCategories?.flatEntryCategories.get(categoryId);
              return {
                categoryId,
                amount: (entryCategory?.sign ?? 0) * (entryItem?.amount ?? 0),
                comments: entryItem.comments ?? undefined,
              };
            }) ?? [];
          const entry: EntryDataDto = {
            type: 'ENTRY',
            date: accountEntry.movementDate?.date ?? new Date(),
            bookingDate: accountEntry.movementDate?.bookingDate ?? undefined,
            budgetPeriod: accountEntry.movementDate?.budgetPeriod ?? undefined,
            entryItems: entryItems,
            amount: entryItems.reduce((amount, entryItem) => amount + entryItem.amount, 0),
          };
          return entry;
        }),
      )
      .subscribe({
        next: (data) => this.dialogRef.close(data),
        error: (err: ApiErrorDto) => this.notifierService.notify('error', err.description ?? ''),
      });
  }
}
