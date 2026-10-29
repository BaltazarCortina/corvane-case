# Hand labels for the note classifier

`label-sample.csv` is the sample of account notes the LLM is judged against: 40 notes drawn at random,
20 from the notes a keyword screen flags and 20 from the rest (`npm run eval:sample` draws it again,
always the same). The group each note comes from is left out on purpose.

To label it, copy it to `labels.csv` and fill in, for each note, without looking at what the LLM said:

| Column | Values | How to choose |
|---|---|---|
| `risk` | `none`, `low`, `medium`, `high` | **high**: the customer decided, or is acting, to end or reduce the relationship (said so, sent a notice, moved work to someone else, asked how to get out), or the conflict went beyond the account manager (formal complaint, lawyer, regulator). **medium**: a concrete problem, or pressure from a competitor, that can lead there if nobody acts. **low**: minor friction, or a problem already resolved in the note. **none**: routine work, or something positive |
| `reasons` | `service`, `price`, `competitor`, `billing`, `other`, separated by `;` | Only when risk is not `none`. **service**: work not done, late or done badly, late reports. **price**: pushback on price. **competitor**: another company quoting, bidding or doing the work. **billing**: wrong, duplicated or disputed invoices |
| `note_type` | `customer`, `internal`, `prospect` | **internal**: about Corvane itself (for example, staffing at a branch), even if it affects the customer. **prospect**: the company is not a customer yet |
| `comment` | free text, optional | Doubts, or why a note was hard to call |

Judge each note on its own, by what it says, not by what you know of the customer.
