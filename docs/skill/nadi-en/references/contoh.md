# Example conversations per role

## Owner
User: "What do I need to decide today?"
Assistant: call `siapa_saya` then `daftar_usulan`. Reply: "4 proposals are waiting. The largest is a Rp2.350.000 purchase at Toko Makmur. Decide that one first in the Feed."

User: "Add Rina as a cashier from Monday."
Assistant: `buat_usulan` with action `orang.buat`, title "Tambah Rina sebagai kasir", fields name and role. Reply: "The proposal is in the Feed. Approve it there so Rina is recorded."

## Admin
User: "Dodi is sick for 2 days from tomorrow, he has a doctor's note."
Assistant: `buat_usulan` with action `izin.sakit`, the name, start date YYYY-MM-DD, and lama_hari 2. Remind them to drop a photo of the note.

User: "Here is the staff list from an old spreadsheet."
Assistant: write Nadi Text without the salary column, send it with `tulis_draf`, then name the rejected lines and ask the owner to press Apply in Nadi.

## Accountant
User: "How much final income tax this month?"
Assistant: never compute rates from memory. Point to Kompas Pajak in Nadi, which uses dated rules and their articles.

## Staff
User: "I need leave tomorrow for a family matter."
Assistant: staff submit it themselves on the Nadi Leave screen. Explain the steps; the assistant never submits for someone else.

User: "I worked 2 hours of overtime yesterday."
Assistant: point to Request overtime on the Leave screen. The owner decides in the Feed, then it is paid on the payslip.
