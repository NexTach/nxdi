#!/usr/bin/env python3
"""Mechanical checks for Korean TDIV notice/disclosure drafts."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


DATE_RE = re.compile(r"\b\d{4}/\d{2}/\d{2}\b")
TIME_RE = re.compile(r"\b\d{2}:\d{2}\b")
UNCOMMAED_WON_RE = re.compile(r"(?<![\d,])\d{4,}원")


def read_text(path: str | None) -> str:
    if path:
        return Path(path).read_text(encoding="utf-8")
    return sys.stdin.read()


def check(text: str) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    first_line = next((line.strip() for line in text.splitlines() if line.strip()), "")
    is_notice = "[공지]" in first_line
    is_disclosure = "[공시]" in first_line

    if not first_line:
        errors.append("Draft is empty.")
    elif not (is_notice or is_disclosure):
        errors.append("First non-empty line must contain either [공지] or [공시].")

    if "[공지]" in text and "[공시]" in text:
        warnings.append("Draft contains both [공지] and [공시]; split planned and completed matters unless this is only explanatory text.")

    if "[공시일]" not in text:
        errors.append("Missing [공시일].")

    if "[공시일]" in text:
        disclosure_day_lines = [line for line in text.splitlines() if "[공시일]" in line]
        if not any(DATE_RE.search(line) for line in disclosure_day_lines):
            errors.append("[공시일] must use YYYY/MM/DD.")

    if "1째주" in text:
        errors.append("Use 1주차 or 첫째 주 instead of 1째주.")

    bad_amounts = sorted(set(UNCOMMAED_WON_RE.findall(text)))
    if bad_amounts:
        warnings.append("KRW amounts should use thousands separators: " + ", ".join(bad_amounts))

    if is_notice:
        if "예정" not in text:
            warnings.append("[공지] drafts should clearly state the planned status with 예정 wording.")
        if "체결되었음을" in text or "완료되었음을" in text:
            errors.append("[공지] should not state that the event has already been executed or completed.")

    if is_disclosure:
        if "[예정" in text or "예정임을 공지" in text:
            errors.append("[공시] should not use planned-event fields or wording.")
        if not ("체결" in text or "완료" in text):
            warnings.append("[공시] should clearly state execution or completion.")

    if ("[예정 금액]" in text or "예정 금액" in text) and not ("환율" in text and "수수료" in text):
        warnings.append("Planned amount wording should mention exchange rates and fees.")

    if ("[총 증자액]" in text or "[체결금액]" in text or "체결 금액" in text) and "실제" not in text:
        warnings.append("Final amount wording should identify the actual executed amount.")

    has_trade_detail_wording = any(term in text for term in ("상세 거래 내역", "상세 내역", "체결 내역"))
    has_attachment_or_disclosure_wording = "첨부" in text or "별도로 공시" in text
    if not (has_trade_detail_wording and has_attachment_or_disclosure_wording):
        warnings.append("Add wording about detailed trade records being attached or separately disclosed.")

    if DATE_RE.search(text) is None:
        warnings.append("No YYYY/MM/DD date found.")

    malformed_dates = re.findall(r"\b\d{4}[.-]\d{1,2}[.-]\d{1,2}\b", text)
    if malformed_dates:
        warnings.append("Use YYYY/MM/DD instead of date formats like: " + ", ".join(sorted(set(malformed_dates))))

    if TIME_RE.search(text) is None and any(label in text for label in ("[체결 일시]", "[예정 일시]", "[축소 일시]")):
        warnings.append("Time fields should include HH:MM when a time is known.")

    return errors, warnings


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate a Korean TDIV notice/disclosure draft.")
    parser.add_argument("path", nargs="?", help="Draft file path. Reads stdin when omitted.")
    args = parser.parse_args()

    text = read_text(args.path)
    errors, warnings = check(text)

    for message in errors:
        print(f"ERROR: {message}")
    for message in warnings:
        print(f"WARNING: {message}")

    if not errors and not warnings:
        print("OK: no mechanical issues found.")

    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
