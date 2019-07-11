import { Component, OnInit, ViewChild, TemplateRef, OnDestroy } from '@angular/core';
import { DatatableComponent } from '@swimlane/ngx-datatable';
import { IView } from '../../../../shared/interfaces/views.interface';
import { ActivatedRoute, Router } from '@angular/router';
import { SessionService } from '../../../services/session.service';
import { ViewsService } from '../../../services/store/views.service';
import { ViewsIPCService } from '../../../services/ipc/views.ipc.service';
import { NgModel } from '@angular/forms';
import { NbMenuService } from '@nebular/theme';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-view-view',
  templateUrl: './view.component.html',
  styleUrls: ['./view.component.scss']
})
export class ViewViewComponent implements OnInit, OnDestroy {

  @ViewChild(DatatableComponent, { static: false }) table: DatatableComponent;
  @ViewChild('tableContextMenuTmpl', { static: true }) tableContextMenuTmpl: TemplateRef<any>;

  view: IView;
  isLoading: boolean = false;
  title: string;

  rows = [];
  columns = [];

  totalElements:number = 0;
  offset: number = 0;
  limit: number = 10;

  searchInputModel: NgModel;
  showSearchClear: boolean = false;

  menuItems:any = []

  menuServiceObserver:Subscription;
  routeObserver:Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sessionsService: SessionService,
    private viewsService: ViewsService,
    private viewsIPCService: ViewsIPCService,
    private menuService: NbMenuService
  ) { }

  async ngOnInit() {
    this.routeObserver = this.route.parent.params.subscribe((params) => {
      console.log("params", params);
      this.loadView();
    });

    this.menuServiceObserver = this.menuService.onItemClick().subscribe(item => {
      switch(item.item.title) {
        case 'Edit':
          this.editRow(item.item.data)
        break;
        case 'Delete':
          this.deleteRow(item.item.data);
        break;
      }
    });
  }

  ngOnDestroy() {
    this.menuServiceObserver.unsubscribe();
    this.routeObserver.unsubscribe();
  }
  
  editRow(row) {
    console.log("edit", row)
    let pk: string = this.primaryKeyColumn;
    if (!pk) {
      // toast no OK
      return;
    }
    let pkValue = row[pk];
    this.router.navigate(['/views', this.view.id, 'view', 'edit', pk, pkValue])
  }

  deleteRow(row) {

  }

  clearSearch() {
    // reset search box input
    this.searchInputModel = '' as any;

    this.showSearchClear = false;

    // fast way to reload results
    this.selectLimit(this.limit);
  }

  selectLimit(value) {
    this.limit = Number(value);
    this.offset = 0;
    this.setPage({
      offset: this.offset,
      limit: this.limit,
      pageSize: this.limit
    })
  }

  get primaryKeyColumn(): string {
    let pri:string = null;
    this.view.columns.forEach(col => {
      if (col.key == "PRI") {
        pri = col.name;
      }
    })
    return pri;
  }

  async loadView() {
    if (this.route.parent.snapshot.paramMap.has('id')) {
      // has id, we are in edit mode
      this.view = this.viewsService.get(
        Number(this.route.parent.snapshot.paramMap.get('id'))
      );
      this.title = this.view.name;
    }
    this.menuItems = [
      {
        title: 'Edit',
        icon: 'edit-2',
        hidden: !this.view.permissions.update
      },
      {
        title: 'Delete',
        icon: 'trash-2',
        hidden: !this.view.permissions.delete
      }
    ]
    await this.reload();
  }

  async reload() {
    let data = await this.viewsIPCService.readData(this.view.table, this.view.columns.filter(col => col.enabled).map(col => col.name), this.limit, this.offset);
    this.totalElements = data.count;
    let columns = data.data.length > 0 ? Object.keys([...data.data].shift()).map(val => ({ name: val, prop: val })) : [];
    console.log("columns", columns)
    this.columns = [...columns, { cellTemplate: this.tableContextMenuTmpl, frozenRight: true, maxWidth: 50, resizeable: false }];
    this.rows = [...data.data];
    console.log("rows", this.rows)
    console.log(data);
  }

  async pageReload() {
    
  }

  async setPage(pageInfo){
    console.log("pageInfo:", pageInfo);
    this.offset = pageInfo.offset;
    let sqlOffset = this.offset * pageInfo.pageSize;
    let data = await this.viewsIPCService
      .readData(
        this.view.table, 
        this.view.columns.map(col => col.name), 
        this.limit, 
        sqlOffset,
        this.view.columns.filter(col => col.searchable).map(col => col.name),
        (this.searchInputModel && String(this.searchInputModel).length > 1) ? String(this.searchInputModel)  : null
      );
    this.rows = [...data.data];
  }

  doSearch(event) {
    this.showSearchClear = String(this.searchInputModel).length >1;

    // if no search input, the user clear the text, reload the result to reset
    if (String(this.searchInputModel).length == 0) return this.selectLimit(this.limit)

    // validate min. of 2 chars
    if (String(this.searchInputModel).length < 2) return;

    // fast way to reload the table
    this.selectLimit(this.limit);
  }

  setContextItems(row) {
    this.menuItems = [...this.menuItems].map(mItem => {
      mItem.data = row;
      return mItem
    });
  }

}
