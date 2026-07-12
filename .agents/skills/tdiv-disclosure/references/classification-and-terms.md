# Classification and Terms

Use this reference first to decide which Korean document type and operating action apply.

## Notice vs Disclosure

| Korean tag | Use for          | Meaning                                                                                                                       |
|------------|------------------|-------------------------------------------------------------------------------------------------------------------------------|
| `[공지]`     | Planned events   | Advance notice for an event that has not yet been executed, such as a planned capital increase or planned sale.               |
| `[공시]`     | Completed events | After-the-fact report for an event that has already been executed or completed, such as an executed capital increase or sale. |

Rules:

- If one matter contains both planned and completed portions, split it into separate `[공지]` and `[공시]` drafts.
- After a planned event is executed, convert the result into a `[공시]` that reflects the completed execution facts.
- Do not describe a future execution as completed, and do not describe a completed execution as merely planned.

## Operating Action Types

Always identify the operating action first. Use `[행위 구분]` or `[증자 구분]` in the output when applicable.

| Korean action | Definition                                                                                                     | Direction of managed capital    |
|---------------|----------------------------------------------------------------------------------------------------------------|---------------------------------|
| `증자`          | Expanding managed capital.                                                                                     | Increase                        |
| `축소`          | Recovering some or all of the company's own capital-increase portion or stake, reducing total managed capital. | Decrease                        |
| `리밸런싱`        | Keeping total size unchanged while selling, replacing, or adjusting holdings.                                  | Maintained; composition changes |

The same sale can have different meanings:

- Use `리밸런싱` when the sale changes portfolio composition while keeping the managed capital scale.
- Use `축소` when the sale or recovery reduces the company's own capital-increase portion and lowers the total managed capital scale.

## Capital Increase Subtypes

Use the most specific subtype available.

| Korean subtype | Definition                                                                                 | Example                                       |
|----------------|--------------------------------------------------------------------------------------------|-----------------------------------------------|
| `정기 증자`        | Regular weekly capital increase independent of outside investment.                         | Weekly regular increase, usually `원화 10,000원`. |
| `추가 증자`        | Increase linked to a fixed ratio of outside investor capital when outside investors exist. | External-investment-linked amount.            |
| `정기 특별 증자`     | Special increase repeated according to a pre-announced period or cycle.                    | Monthly 9th, `원화 5,125원`.                     |
| `수시 특별 증자`     | One-off special increase executed immediately without advance scheduling.                  | `34,148원` case, `3,954원` case.                |

Avoid using only `특별 증자` when the event should distinguish scheduled recurring special increases from one-off immediate special increases.

## Reduction Scope

`축소` means the company recovers part or all of the company-funded stake created through capital increases.

- The reduction target is only `당사 증자분`.
- Investor capital is not a reduction target.
- After reduction, the investor capital ratio relative to total managed capital may increase.
- Dividend allocation effects depend on the post-reduction portfolio composition.
- Reductions must also be separated into `[공지]` for planned reductions and `[공시]` for completed reductions.
- Related fields: `[행위 구분] 축소`, `[축소 규모]`, `[축소 일시]` or `[축소 기간]`, `[축소 대상] 당사 증자분`, `[사유]`.
