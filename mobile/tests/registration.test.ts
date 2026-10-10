import assert from "node:assert/strict";
import { test } from "node:test";
import { registrationErrors } from "../src/features/auth/registration";

const account = {
  displayName: " Elif Yılmaz ",
  username: " ELIF_42 ",
  email: " elif@example.com ",
  password: "   uzun bir parola   ",
};
test("kayıt boşluklu parolayı korur; kullanıcı adı nokta kabul etmez", () => {
  assert.ok(
    Object.values(registrationErrors(account, account.password)).every(
      (value) => value === undefined,
    ),
  );
  assert.ok(
    registrationErrors(
      { ...account, username: "elif.yilmaz" },
      account.password,
    ).handle,
  );
  assert.ok(registrationErrors(account, account.password.trim()).password2);
});
test("kayıt backend parola ve ad sınırlarında kabul/red uygular", () => {
  for (const length of [15, 128])
    assert.equal(
      registrationErrors(
        { ...account, password: "a".repeat(length) },
        "a".repeat(length),
      ).password,
      undefined,
    );
  for (const length of [14, 129])
    assert.ok(
      registrationErrors(
        { ...account, password: "a".repeat(length) },
        "a".repeat(length),
      ).password,
    );
  assert.ok(
    registrationErrors({ ...account, displayName: " " }, account.password)
      .fullName,
  );
  assert.ok(
    registrationErrors(
      { ...account, displayName: "a".repeat(81) },
      account.password,
    ).fullName,
  );
});
