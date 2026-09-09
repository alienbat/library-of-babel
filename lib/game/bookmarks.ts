import {PAGE_COUNT} from './books.ts';
import type {GlobalBook} from './global-books.ts';
export const BOOKMARK_STORAGE='babel-bookmarks-v1';
export type Bookmark={id:string;name:string;page:number;book:GlobalBook};
export function bookmarkName(name:unknown){
  if(typeof name!=='string'||!name.trim())throw new RangeError('Give this book a name.');
  if(name.trim().length>120)throw new RangeError('Use a name of 120 characters or fewer.');
  return name.trim();
}
export function bookmarkPage(page:unknown):number{
  if(typeof page!=='number'||!Number.isInteger(page)||page<0||page>=PAGE_COUNT)throw new RangeError('Invalid bookmarked page.');
  return page;
}
export function upsertBookmark(records:Bookmark[],book:GlobalBook,name:unknown,page:unknown,equal:(a:GlobalBook,b:GlobalBook)=>boolean,id:string):Bookmark{
  const cleaned=bookmarkName(name),savedPage=bookmarkPage(page),existing=records.find(b=>equal(b.book,book));
  if(existing){existing.name=cleaned;existing.page=savedPage;return existing;}
  const saved={id,name:cleaned,page:savedPage,book};records.push(saved);return saved;
}
