# PatternFly UX Audit Checklist

Use this checklist as a quick reference when auditing PatternFly React applications.

## 🎨 PatternFly Design System Compliance

### Component Usage
- [ ] All UI components use PatternFly equivalents (not custom reimplementations)
- [ ] No deprecated PatternFly components in use
- [ ] Components used according to their intended purpose
- [ ] Correct component variants used (primary, secondary, danger, etc.)
- [ ] Props passed correctly per PatternFly API documentation

### Layout & Spacing
- [ ] Page structure uses `Page` and `PageSection` components
- [ ] Layouts use PatternFly layout components (`Grid`, `Stack`, `Flex`, `Split`)
- [ ] Spacing uses PatternFly tokens (not hardcoded px values)
- [ ] Consistent spacing throughout the application
- [ ] Responsive layouts for mobile, tablet, desktop

### Colors & Theming
- [ ] Colors use PatternFly color tokens (not hex codes)
- [ ] Proper use of semantic colors (danger for destructive, success for positive, etc.)
- [ ] Sufficient color contrast (minimum 4.5:1 for text)
- [ ] Dark mode support if applicable

### Common Patterns
- [ ] **Navigation**: `Nav` component with proper structure
- [ ] **Data tables**: `Table` with proper toolbar and pagination
- [ ] **Forms**: `Form`, `FormGroup` with proper layout
- [ ] **Modals**: Proper header, body, footer structure
- [ ] **Empty states**: Using `EmptyState` component
- [ ] **Loading states**: `Spinner` or `Progress` components
- [ ] **Error states**: `Alert` component with appropriate variant

---

## ♿ WCAG Accessibility Compliance

### 1.1 Text Alternatives (Level A)
- [ ] All images have alt text (`alt` attribute)
- [ ] Decorative images have empty alt (`alt=""`)
- [ ] Complex images/charts have detailed descriptions
- [ ] Icons have `aria-label` when used without text

### 1.3 Adaptable (Level A)
- [ ] Proper heading hierarchy (h1 → h2 → h3, no skipping)
- [ ] Semantic HTML elements (`<nav>`, `<main>`, `<article>`, `<section>`)
- [ ] Data tables use `<th>` with proper scope
- [ ] Lists use `<ul>`, `<ol>`, `<dl>` appropriately

### 1.4 Distinguishable (Level AA)
- [ ] Color contrast meets 4.5:1 for normal text
- [ ] Color contrast meets 3:1 for large text (18pt+)
- [ ] Color contrast meets 3:1 for UI components and graphics
- [ ] Information not conveyed by color alone
- [ ] Text can be resized to 200% without breaking layout

### 2.1 Keyboard Accessible (Level A)
- [ ] All interactive elements keyboard accessible
- [ ] No keyboard traps (can tab in and out of all components)
- [ ] Logical tab order (follows visual flow)
- [ ] Skip links available to skip repetitive content
- [ ] Keyboard shortcuts don't interfere with assistive tech

### 2.4 Navigable (Level A & AA)
- [ ] Each page has a unique, descriptive `<title>`
- [ ] Focus order is logical and intuitive
- [ ] Focus indicators are clearly visible
- [ ] Link text is descriptive (not "click here")
- [ ] Multiple ways to navigate (nav, search, breadcrumbs)
- [ ] Headings and labels are descriptive
- [ ] Current page/location is indicated

### 3.1 Readable (Level A)
- [ ] Page language is set (`<html lang="en">`)
- [ ] Language changes are marked (`lang` attribute)

### 3.2 Predictable (Level A)
- [ ] Components behave consistently across pages
- [ ] No unexpected focus changes
- [ ] No automatic form submission on input
- [ ] Consistent navigation across pages

### 3.3 Input Assistance (Level A & AA)
- [ ] Form labels are programmatically associated (`htmlFor` or `aria-labelledby`)
- [ ] Error messages are specific and helpful
- [ ] Required fields marked with `required` or `aria-required="true"`
- [ ] Errors announced to screen readers (`aria-live` regions)
- [ ] Suggestions provided for fixing errors

### 4.1 Compatible (Level A)
- [ ] Valid HTML (no duplicate IDs, proper nesting)
- [ ] ARIA attributes used correctly
- [ ] Name, role, value exposed for all UI components
- [ ] Status messages use `role="status"` or `aria-live`

### PatternFly-Specific A11y
- [ ] PatternFly accessibility props used (`aria-label`, `aria-labelledby`)
- [ ] Modal focus management configured correctly
- [ ] Dropdown/Select keyboard navigation works
- [ ] Table assistive text provided for screen readers
- [ ] Alert `aria-live` regions configured

---

## 🎯 UX Best Practices

### Consistency
- [ ] Consistent terminology throughout app
- [ ] Consistent button placement and styling
- [ ] Consistent navigation patterns
- [ ] Consistent error messaging format
- [ ] Consistent icon usage

### Clarity & Feedback
- [ ] Clear calls-to-action (obvious what user should do next)
- [ ] Loading indicators for async operations (>1 second)
- [ ] Success messages after important actions
- [ ] Error messages are specific and actionable
- [ ] Form validation provides immediate feedback
- [ ] Empty states guide users on what to do

### Error Prevention & Recovery
- [ ] Input validation prevents invalid data
- [ ] Constraints clearly communicated (character limits, format)
- [ ] Confirmation dialogs for destructive actions (delete, remove)
- [ ] Inline validation for forms (before submission)
- [ ] Ability to undo destructive actions when possible
- [ ] Unsaved changes warnings when navigating away

### Information Architecture
- [ ] Logical content grouping (related items together)
- [ ] Progressive disclosure (essential info first)
- [ ] Scannable content (headings, lists, short paragraphs)
- [ ] Appropriate information density (not too crowded)
- [ ] Clear visual hierarchy (most important elements stand out)

### Forms & Data Entry
- [ ] Form fields have clear labels
- [ ] Help text provided for complex fields
- [ ] Optional fields clearly marked
- [ ] Smart defaults when possible
- [ ] Autofocus on first field when appropriate
- [ ] Form remembers data if user navigates away

### Navigation & Wayfinding
- [ ] Clear indication of current location (active nav, breadcrumbs)
- [ ] Easy to return to previous page/state
- [ ] Search functionality for content-heavy apps
- [ ] Clear hierarchy in navigation
- [ ] Mobile menu works well on small screens

### Performance & Polish
- [ ] No layout shifts (CLS)
- [ ] Smooth animations and transitions
- [ ] Optimized images (appropriate sizes)
- [ ] Fast load times (<3 seconds)
- [ ] Responsive on mobile devices
- [ ] Works in all major browsers

### PatternFly-Specific UX
- [ ] Table toolbars include filters, search, actions
- [ ] Compact table variant used when appropriate
- [ ] Danger buttons only for destructive actions
- [ ] Primary button used sparingly (one per section)
- [ ] Tooltips on icon-only buttons
- [ ] Breadcrumbs for nested navigation
- [ ] EmptyState used when no data available

---

## 🎖️ Severity Guidelines

Use these guidelines to prioritize issues:

### Critical (Fix immediately)
- Complete accessibility blockers (keyboard traps, missing alt text on critical images)
- Broken functionality
- Security vulnerabilities
- Data loss risks

### High (Fix before next release)
- Significant accessibility issues (poor contrast, missing labels)
- Major UX problems (confusing workflows, unclear errors)
- Not using PatternFly components where available
- Inconsistent patterns

### Medium (Fix soon)
- Minor accessibility issues
- UX improvements (better loading states, clearer messaging)
- PatternFly best practices not followed
- Performance issues

### Low (Nice to have)
- Small inconsistencies
- Minor polish items
- Documentation improvements
- Edge case handling

---

## 📝 Audit Report Template

```markdown
# UX Audit Report
**Date**: [Date]
**Audited by**: [Name]
**Scope**: [Components/pages audited]

## Executive Summary
- **Overall Score**: X/100
- **Critical Issues**: X
- **High Priority**: X
- **Medium Priority**: X
- **Low Priority**: X

## Critical Issues

### 1. [Issue Title]
- **Category**: [PatternFly / Accessibility / UX]
- **Location**: `file/path.tsx:123`
- **Issue**: [Description]
- **Impact**: [How this affects users]
- **Recommendation**: [How to fix]
- **Resources**: [Links]

[Repeat for each issue...]

## Recommendations
1. [Priority 1]
2. [Priority 2]
3. etc.
```

---

## Resources

- [PatternFly Design Guidelines](https://www.patternfly.org/guidelines/about-guidelines/)
- [PatternFly Accessibility Guide](https://www.patternfly.org/accessibility/accessibility-fundamentals)
- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [WAVE Browser Extension](https://wave.webaim.org/extension/)
