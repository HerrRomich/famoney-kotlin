import { CdkVirtualScrollViewport, VIRTUAL_SCROLL_STRATEGY } from '@angular/cdk/scrolling';
import { AfterViewInit, Component, Inject, OnDestroy, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { EcoFabSpeedDialActionsComponent, EcoFabSpeedDialComponent } from '@ecodev/fab-speed-dial';
import { AccountDto, MovementDto } from '@famoney-apis/accounts';
import { AccountEntryDialogComponent } from '@famoney-features/accounts/components/account-entry-dialog';
import { EntryDialogData } from '@famoney-features/accounts/models/account-entry.model';
import { AccountsService } from '@famoney-features/accounts/services/accounts.service';
import { EntryCategoryService } from '@famoney-shared/services/entry-category.service';
import { TranslateService } from '@ngx-translate/core';
import { NotificationsService } from 'angular2-notifications';
import { EMPTY, Subject, Subscription } from 'rxjs';
import { debounceTime, filter, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { MovementsService } from '../../services/movements.service';
import { AccountMovementsViertualScrollStrategy } from './account-movements.virtual-scroller-strategy';
import { MovementDataSource } from './movement-data-source';

const fabSpeedDialDelayOnHover = 350;

@Component({
  selector: 'fm-account-table',
  templateUrl: 'account-table.component.html',
  styleUrls: ['account-table.component.scss'],
  providers: [
    {
      provide: VIRTUAL_SCROLL_STRATEGY,
      useClass: AccountMovementsViertualScrollStrategy,
    },
  ],
})
export class AccountTableComponent implements AfterViewInit, OnDestroy {
  movementDataSource: MovementDataSource;

  @ViewChild('fabSpeedDial', { static: true })
  fabSpeedDial: EcoFabSpeedDialComponent | undefined;

  @ViewChild('fabSpeedDialActions', { static: true })
  fabSpeedDialActions: EcoFabSpeedDialActionsComponent | undefined;

  @ViewChild(CdkVirtualScrollViewport)
  viewPort!: CdkVirtualScrollViewport;

  private _speedDialHovered$ = new Subject<boolean>();

  private _speedDialTriggerSubscription?: Subscription;

  private _fabSpeedDialOpenChangeSubbscription?: Subscription;
  private _accountDTO?: AccountDto;

  constructor(
    private _route: ActivatedRoute,
    private _accountsService: AccountsService,
    private _movementsService: MovementsService,
    private _accountEntryDialogComponent: MatDialog,
    private _entryCategoriesService: EntryCategoryService,
    private _notificationsService: NotificationsService,
    private _translateService: TranslateService,
    @Inject(VIRTUAL_SCROLL_STRATEGY)
    private _accountMovementsViertualScrollStrategy: AccountMovementsViertualScrollStrategy,
  ) {
    const account$ = this._route.paramMap.pipe(
      map(params => Number.parseInt(params.get('accountId') ?? '', 10)),
      tap(() => (this._accountDTO = undefined)),
      filter(accountId => Number.isInteger(accountId)),
      switchMap(accountId =>
        this._accountsService.getAccount(accountId).pipe(
          tap(accountDTO => {
            this._accountDTO = accountDTO;
            this._accountMovementsViertualScrollStrategy.switchAccount(accountDTO.movementCount);
          }),
        ),
      ),
      shareReplay(1),
    );
    this.movementDataSource = new MovementDataSource(this._movementsService, account$);
  }

  ngAfterViewInit() {
    this._fabSpeedDialOpenChangeSubbscription = this.fabSpeedDial!.openChange.pipe(
      tap(opened => {
        this.fabSpeedDial!.fixed = !opened;
      }),
    ).subscribe();

    this._speedDialTriggerSubscription = this._speedDialHovered$
      .pipe(
        debounceTime(fabSpeedDialDelayOnHover),
        tap(hovered => {
          this.fabSpeedDial!.open = hovered;
        }),
      )
      .subscribe();
  }

  ngOnDestroy() {
    this._fabSpeedDialOpenChangeSubbscription?.unsubscribe();
    this._speedDialTriggerSubscription?.unsubscribe();
  }

  get inverseTranslation(): string {
    if (!this.viewPort || !this.viewPort['_renderedContentTransform']) {
      return '-0px';
    }
    return `-${this.viewPort['_renderedContentOffset']}px`;
  }

  getSumColor(sum: number | undefined) {
    return !sum ? undefined : sum > 0 ? 'positive-amount' :  'negative-amount';
  }

  triggerSpeedDial() {
    this._speedDialHovered$.next(true);
  }

  stopSpeedDial() {
    this._speedDialHovered$.next(false);
  }

  getMovementComments(movement?: MovementDto) {
    const movementData = movement?.data;
    switch (movementData?.type) {
      case 'ENTRY':
        const entryItems = movementData?.entryItems ?? [];
        return entryItems.length === 1 ? entryItems[0].comments : undefined;
      case 'REFUND':
      case 'TRANSFER':
        return movementData?.comments;
      default:
        return undefined;
    }
  }

  getMovementCategoryPath$(movement?: MovementDto) {
    const movementData = movement?.data;
    switch (movementData?.type) {
      case 'ENTRY':
        const entryItems = movementData?.entryItems ?? [];
        return entryItems.length === 1 ? this.getCategoryPathById$(entryItems[0].categoryId) : EMPTY;
      case 'REFUND':
        return this.getCategoryPathById$(movementData?.categoryId);
      default:
        return EMPTY;
    }
  }

  private getCategoryPathById$(categoryId: number) {
    return this._entryCategoriesService.entryCategoriesForVisualisation$.pipe(
      map(entryCategories => entryCategories.flatEntryCategories.get(categoryId)?.fullPath),
    );
  }

  addEntry() {
    this.stopSpeedDial();
    if (this._accountDTO === undefined) {
      this.showNoAccountErrorNotification();
      return;
    }
    const accountId = this._accountDTO.id;
    this.openAccountEntryDialog({
      accountId: accountId,
    }).subscribe();
  }

  private showNoAccountErrorNotification() {
    this._translateService
      .get(['notifications.title.error', 'accounts.table.errors.noAccount'])
      .pipe(
        tap((errorMesages: { [key: string]: string }) =>
          this._notificationsService.error(
            errorMesages['notifications.title.error'],
            errorMesages['accounts.table.errors.noAccount'],
          ),
        ),
      )
      .subscribe();
  }

  private openAccountEntryDialog(data: EntryDialogData) {
    const accountEntryDialogRef = this._accountEntryDialogComponent.open<
      AccountEntryDialogComponent,
      EntryDialogData,
      MovementDto
    >(AccountEntryDialogComponent, {
      width: '520px',
      minWidth: '520px',
      maxWidth: '520px',
      panelClass: 'account-entry-dialog',
      disableClose: true,
      hasBackdrop: true,
      data: data,
    });
    return accountEntryDialogRef.afterClosed();
  }

  addTransfer() {
    console.log('Add transfer.');
  }

  addRefund() {
    console.log('Add refund.');
  }

  edit(movement: MovementDto) {
    if (this._accountDTO === undefined) {
      this.showNoAccountErrorNotification();
      return;
    }
    const accountId = this._accountDTO.id;
    if (movement.data?.type === 'ENTRY') {
      this.openAccountEntryDialog({
        accountId: accountId,
        movementId: movement.id,
        entryData: movement.data,
      }).subscribe();
    }
  }
}
