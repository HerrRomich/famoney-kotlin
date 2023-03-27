import { Injectable } from '@angular/core';
import { EntryCategoryDto, EntryCategoriesDto, MasterDataApiService } from '@famoney-apis/master-data';
import { exclusiveCheck } from '@famoney-shared/misc';
import { NotificationsService } from 'angular2-notifications';
import { BehaviorSubject, EMPTY, Observable } from 'rxjs';
import { catchError, map, shareReplay, switchMap } from 'rxjs/operators';

export interface EntryCategory {
  id: number;
  type: EntryCategoryDto['type'];
  name: string;
}

export interface HierarchicalEntryCategory {
  id: number;
  type: EntryCategoryDto['type'];
  name: string;
  children: HierarchicalEntryCategory[];
}

export interface FlatEntryCategory extends EntryCategory {
  path: string;
  fullPath: string;
  level: number;
}

export class FlatEntryCategoryObject implements Readonly<FlatEntryCategory> {
  readonly id: number;
  readonly type: EntryCategoryDto['type'];
  readonly name: string;
  readonly path: string;
  readonly fullPath: string;
  readonly level: number;

  constructor(data: FlatEntryCategory) {
    this.id = data.id;
    this.type = data.type;
    this.name = data.name;
    this.path = data.path;
    this.fullPath = data.fullPath;
    this.level = data.level;
  }

  getCategorySign() {
    switch (this.type) {
      case 'EXPENSE':
        return -1;
      case 'INCOME':
        return 1;
      default:
        return exclusiveCheck(this.type)        
    }
  }
}

interface EntryCategories {
  flatEntryCategories: Map<number, FlatEntryCategoryObject>;
  expenses: EntryCategory[];
  incomes: EntryCategory[];
}

export const pathSeparator = ' ' + String.fromCharCode(8594) + ' ';
@Injectable({
  providedIn: 'root',
})
export class EntryCategoryService {
  readonly entryCategories$: Observable<EntryCategoriesDto>;
  readonly entryCategoriesForVisualisation$: Observable<EntryCategories>;
  private _entryCategoriesRefreshSubject = new BehaviorSubject<void>(undefined);

  constructor(private notificationsService: NotificationsService, private masterDataApiService: MasterDataApiService) {
    this.entryCategories$ = this._entryCategoriesRefreshSubject.pipe(
      switchMap(() => this.masterDataApiService.getEntryCategories()),
      shareReplay(1),
      catchError(() => {
        this.notificationsService.error('Error', 'Couldn\t load entry categories.');
        return EMPTY;
      }),
    );
    this.entryCategoriesForVisualisation$ = this.entryCategories$.pipe(
      map(entryCategories => {
        const flatEntryCategories = new Map<number, FlatEntryCategoryObject>();
        this.flattenEntryCategories(flatEntryCategories, entryCategories.expenses);
        this.flattenEntryCategories(flatEntryCategories, entryCategories.incomes);
        return {
          flatEntryCategories: flatEntryCategories,
          expenses: entryCategories.expenses,
          incomes: entryCategories.incomes,
        };
      }),
      shareReplay(1),
    );
  }

  private flattenEntryCategories(
    result: Map<number, FlatEntryCategoryObject>,
    entryCategories?: EntryCategoryDto[],
    level = 1,
    path = '',
  ) {
    entryCategories
      ?.filter(entryCategory => entryCategory.id)
      .forEach(entryCategory => {
        const fullPath = (path ? path + pathSeparator : '') + entryCategory.name;
        result.set(
          entryCategory.id,
          new FlatEntryCategoryObject({
            ...entryCategory,
            path: path,
            fullPath: fullPath,
            level: level,
          }),
        );
        this.flattenEntryCategories(result, entryCategory.children, level + 1, fullPath);
      });
  }

  refreshEntryCategories() {
    this._entryCategoriesRefreshSubject.next();
  }
}
