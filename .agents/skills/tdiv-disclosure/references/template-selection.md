# Template Selection

Use this routing guide to choose a Korean template asset. The full templates live in `assets/templates/` because they are reusable output assets rather than explanatory guidance.

| Situation                                                                                     | Korean tag | Operating action                          | Template asset                                   |
|-----------------------------------------------------------------------------------------------|------------|-------------------------------------------|--------------------------------------------------|
| A capital increase is scheduled but not executed.                                             | `[공지]`     | `증자`                                      | `assets/templates/planned-capital-increase.md`   |
| A capital increase has executed or completed.                                                 | `[공시]`     | `증자`                                      | `assets/templates/completed-capital-increase.md` |
| Holdings will be sold for portfolio adjustment, rebalancing, or funding a planned adjustment. | `[공지]`     | usually `리밸런싱`; sometimes related to `축소` | `assets/templates/planned-sale.md`               |
| Holdings have been sold.                                                                      | `[공시]`     | usually `리밸런싱`; sometimes related to `축소` | `assets/templates/completed-sale.md`             |
| The company's capital-increase portion will be reduced.                                       | `[공지]`     | `축소`                                      | `assets/templates/planned-reduction.md`          |
| The company's capital-increase portion has been reduced.                                      | `[공시]`     | `축소`                                      | `assets/templates/completed-reduction.md`        |

Selection rules:

- If a sale is only a trade that supports a reduction, still disclose the sale with a sale template and disclose the reduction separately when needed.
- If the user asks for a review instead of a draft, compare the draft against the template asset selected by this table.
- If no template exactly matches, choose the closest template and preserve the common structure from `style-and-fields.md`.
