# Canadian AI Directory: the data

The list of Canadian AI companies behind [canadianaidirectory.ca](https://canadianaidirectory.ca). Every fact in it comes from the company's own site, with the page address and the words on that page. A journalist, buyer or researcher can follow each figure to its source.

`companies.json` is the list: one record per company. `schema.ts` says what a valid record is. `validate.ts` checks a file against it.

## What a fact is

A company record holds facts under six questions: `owner`, `data`, `models`, `law`, `languages` and `contact`. Each fact has:

1. `value`: the answer, in short.
2. `mark`: `canadian` (the quote says Canada, wholly), `partly` (it says Canada in part), `elsewhere` (it names a place that is not Canada), or `notStated` (it names no place).
3. `url`: an https page on the company's own site. A fact from anywhere else is refused.
4. `quote`: the words on that page the answer comes from, copied as the page shows them, on one line.
5. `checkedAt`: the day you read the page, as YYYY-MM-DD.
6. `status`: `{ "kind": "current" }` for a fact you have just read.

A language fact has a `value` of `en` or `fr`, one fact per language. A contact fact also has `reach` (`person`, `generalLine` or `contactPage`), and `name` and `phone` where the page gives them.

## Open a pull request

1. Change one company per pull request: a correction, a new fact, or a new company.
2. A correction names the page that shows it. Put the page address and the quote in the fact, and say in the pull request what the old fact got wrong.
3. Run `bun validate.ts` before you open it. The same check runs on every pull request, and a pull request that fails it cannot be merged.
4. Only `companies.json` is open to pull requests. `schema.ts`, `validate.ts` and `.github/` change only with the owner's say.

## What the check does not do

It checks that a record is shaped right and that each fact's address is on the company's own site. It cannot tell that a quote is really on the page. A person reads each page against its quote before a pull request is merged.

## How this repo is kept

The site's own copy of the list is the source. After each release of the site, a script copies `companies.json` and `schema.ts` here. When a pull request here is merged, its `companies.json` goes into the site as a data release, so the two stay one list.

## Licence

The data is CC BY 4.0, with the quotes remaining their owners' (see `LICENSE-DATA`). The code is MIT (see `LICENSE`).
