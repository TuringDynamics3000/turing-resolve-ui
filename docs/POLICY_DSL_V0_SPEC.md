# Policy DSL v0 — Deterministic Resolve Constitution Language

This document defines a **minimal, deterministic policy language** suitable for compilation into signed bytecode and execution inside **TuringResolve**.

The design is intentionally conservative:
- **Deterministic**: same inputs + same bytecode → same output.
- **Pure**: no side effects, no network calls.
- **Fail-closed**: missing data and errors never silently “approve”.
- **Auditable**: rule evaluation order is fixed; trace hashing is straightforward.

---

## 1) Core concepts

### Policy artifact
A policy is a signed artifact consisting of:
1. `dsl_source` (human review)
2. compiled `bytecode`
3. hashes (`dsl_hash`, `bytecode_hash`)
4. `signature` (Ed25519 recommended) over `bytecode_hash` (v0)
5. metadata (compiler version, effective dates)

### Inputs are facts (no external calls)
All external information (KYC results, bureau scores, fraud flags, macro indicators) must arrive as **facts** in the input snapshot.  
The policy runtime **must not** call networks, databases, or clocks.

---

## 2) Determinism rules (non-negotiable)

1. **No system time access**: no `now()`. Time is provided via input `decision_time` if needed.
2. **No randomness**.
3. **No floats**. Use `Int64` and `Decimal(p,s)` only.
4. **Explicit rounding** for division. No silent implicit rounding.
5. **Null is explicit**: missing values evaluate to `null`. In `when` conditions, `null` is treated as `false`.
6. **Rule order is deterministic**: first matching rule wins.
7. **Runtime errors fail closed**: any runtime error yields `deny(reason="POLICY_EVAL_ERROR")`.

---

## 3) Types

### Primitive
- `Bool`
- `Int64`
- `Decimal(p,s)` (fixed precision/scale)
- `String`
- `Date` (YYYY-MM-DD)
- `Timestamp` (RFC3339 / UTC)
- `Enum` (declared in `enum` blocks)

### Composite
- `List<T>`
- `Map<K,V>`

### Null
- literal `null` represents missing/unknown.

---

## 4) Grammar (EBNF)

```ebnf
policy_file      ::= policy_decl ;

policy_decl      ::= "policy" string_lit "{" policy_body "}" ;

policy_body      ::= inputs_block? consts_block? enums_block?
                     rule_block+ default_block ;

inputs_block     ::= "inputs" "{" input_decl+ "}" ;
input_decl       ::= path ":" type_spec ";" ;

consts_block     ::= "const" "{" const_decl+ "}" ;
const_decl       ::= ident ":" type_spec "=" expr ";" ;

enums_block      ::= "enum" ident "{" enum_member ("," enum_member)* "}" ;
enum_member      ::= ident ;

rule_block       ::= "rule" string_lit "{" when_clause then_clause "}" ;
when_clause      ::= "when" expr ";" ;
then_clause      ::= "then" action_stmt ";" ;

default_block    ::= "default" action_stmt ";" ;

action_stmt      ::= allow_stmt | deny_stmt | refer_stmt ;

allow_stmt       ::= "allow" "(" "action" "=" string_lit
                     ("," "params" "{" param_assign ("," param_assign)* "}")?
                     ("," "reason" "=" string_lit)? ")" ;

deny_stmt        ::= "deny"  "(" "reason" "=" string_lit ")" ;
refer_stmt       ::= "refer" "(" "reason" "=" string_lit ")" ;

param_assign     ::= ident "=" expr ;

type_spec        ::= "Bool"
                   | "Int64"
                   | "Decimal" "(" int_lit "," int_lit ")"
                   | "String"
                   | "Date"
                   | "Timestamp"
                   | ident               (* enum type *)
                   | "List" "<" type_spec ">"
                   | "Map"  "<" type_spec "," type_spec ">" ;

path             ::= ident ("." ident)* ;

expr             ::= or_expr ;
or_expr          ::= and_expr ("or" and_expr)* ;
and_expr         ::= not_expr ("and" not_expr)* ;
not_expr         ::= ("not")* cmp_expr ;

cmp_expr         ::= add_expr (cmp_op add_expr)? ;
cmp_op           ::= "==" | "!=" | "<" | "<=" | ">" | ">=" ;

add_expr         ::= mul_expr (("+"|"-") mul_expr)* ;
mul_expr         ::= unary_expr (("*"|"/") unary_expr)* ;

unary_expr       ::= ("+"|"-") unary_expr | primary ;

primary          ::= literal
                   | path
                   | func_call
                   | "(" expr ")" ;

func_call        ::= ident "(" (expr ("," expr)*)? ")" ;

literal          ::= "true" | "false"
                   | "null"
                   | int_lit
                   | dec_lit
                   | string_lit ;

int_lit          ::= DIGITS ;
dec_lit          ::= DIGITS "." DIGITS ;
string_lit       ::= QUOTED_STRING ;
```

---

## 5) Type rules

### No implicit coercion
- `Int64 + Decimal` is an error unless explicit cast is used.
- `String` never coerces to numeric.
- Comparisons require compatible numeric types or identical types.

### Null propagation
- Any operation involving `null` returns `null`, except:
  - `exists(x)` returns `Bool`
  - `coalesce(x, y)` returns `y` if `x` is null
- In `when expr;`, a result of `null` is treated as `false`.

### Division
- `/` is **disallowed** for `Decimal` in v0 unless done via `div(x, y, scale, roundingMode)`.
- Integer division may be allowed only for `Int64 / Int64` with truncation semantics.

### Overflow and runtime errors
- Any overflow, divide-by-zero, invalid enum, or type error at runtime → `deny(reason="POLICY_EVAL_ERROR")`.

---

## 6) Built-in functions (v0)

- `exists(x: Any) -> Bool`
- `coalesce(x: T, y: T) -> T`
- `min(a: Decimal, b: Decimal) -> Decimal`
- `max(a: Decimal, b: Decimal) -> Decimal`
- `clamp(x: Decimal, lo: Decimal, hi: Decimal) -> Decimal`
- `div(x: Decimal, y: Decimal, scale: Int64, roundingMode: String) -> Decimal`

Recommended rounding modes:
- `"HALF_EVEN"` (bankers rounding)
- `"HALF_UP"`
- `"DOWN"`

---

## 7) Evaluation order

1. Evaluate rules in file order.
2. The **first** rule whose `when` condition evaluates to `true` is selected.
3. Execute its `then` action and stop evaluation.
4. If no rules match, execute `default`.

---

## 8) Minimal example

```text
policy "credit.auto.v0" {
  inputs {
    customer.credit_score: Int64;
    customer.dti: Decimal(5,4);
    request.amount: Decimal(12,2);
  }

  rule "DTI_LIMIT" {
    when customer.dti > 0.4200;
    then deny(reason="DTI_TOO_HIGH");
  }

  rule "APPROVE" {
    when customer.credit_score >= 700;
    then allow(action="APPROVE", params { amount = request.amount }, reason="AUTO_APPROVE");
  }

  default deny(reason="NO_RULE_MATCH");
}
```

---

## 9) Trace hashing (recommended)
For auditability, the runtime should produce a trace hash that commits to:
- evaluated rule ids/names in order
- each `when` result (true/false/null)
- selected rule
- resulting action + params + reason codes
- any error codes

A simple rolling hash chain over trace steps is sufficient for v0.
