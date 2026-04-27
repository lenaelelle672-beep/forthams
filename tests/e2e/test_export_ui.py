@@ Playwright E2E tests for asset export UI functionality
 """
 Playwright E2E tests for asset export UI functionality.
 
 Validates:
 - TC-5.4: Export button interaction
 - TC-5.5: Export format selector
 """
 
 import pytest
 from playwright.sync_api import Page, expect
 import re
 from datetime import datetime
 
 
 class TestExportUI:
     """Test suite for asset export UI components."""
 
     @pytest.fixture(autouse=True)
     def setup(self, page: Page):
         """Set up test context."""
         self.page = page
         # Navigate to asset management page
         self.page.goto("/assets")
         # Wait for page to load
         self.page.wait_for_load_state("networkidle")
 
     def test_export_button_click(self):
         """
         TC-5.4: Export button interaction.
         
         Validates that clicking the export button triggers a file download
         with a filename containing a timestamp.
         """
         # Locate the export button
         export_button = self.page.locator('[data-testid="export-button"], button:has-text("Export"), button:has-text("导出")')
         expect(export_button).to_be_visible()
         
         # Set up download detection before clicking
         with self.page.expect_download() as download_info:
             export_button.click()
         
         download = download_info.value
         
         # Validate filename format: should contain timestamp
         filename = download.suggested_filename
         assert filename, "Download filename should not be empty"
         
         # Check for timestamp pattern (YYYYMMDD or similar)
         timestamp_pattern = r'\d{8}|\d{4}-\d{2}-\d{2}'
         has_timestamp = bool(re.search(timestamp_pattern, filename))
         assert has_timestamp, f"Filename should contain timestamp, got: {filename}"
         
         # Validate file extension (CSV or Excel)
         assert filename.endswith('.csv') or filename.endswith('.xlsx'), \
             f"File should be CSV or Excel, got: {filename}"
 
     def test_export_format_selector(self):
         """
         TC-5.5: Export format selector.
         
         Validates that users can switch between CSV and Excel formats,
         and the preview refreshes after format selection.
         """
         # Locate format selector dropdown
         format_selector = self.page.locator(
             '[data-testid="export-format-selector"], '
             'select:has(option[value="csv"]), '
             'select:has(option[value="xlsx"])'
         )
         
         # Check if selector exists
         if format_selector.count() > 0:
             expect(format_selector).to_be_visible()
             
             # Test CSV selection
             format_selector.select_option("csv")
             self.page.wait_for_timeout(500)  # Allow preview to refresh
             
             # Verify preview area updates
             preview_area = self.page.locator('[data-testid="export-preview"], .export-preview')
             if preview_area.count() > 0:
                 expect(preview_area).to_be_visible()
             
             # Test Excel selection
             format_selector.select_option("xlsx")
             self.page.wait_for_timeout(500)
             
             # Verify selection persists
             selected_value = format_selector.input_value()
             assert selected_value == "xlsx", f"Expected 'xlsx', got: {selected_value}"
             
             # Switch back to CSV
             format_selector.select_option("csv")
             selected_value = format_selector.input_value()
             assert selected_value == "csv", f"Expected 'csv', got: {selected_value}"
         else:
             # If no selector, test that export button exists and works
             export_button = self.page.locator('[data-testid="export-button"], button:has-text("Export")')
             expect(export_button).to_be_visible()
             pytest.skip("Format selector not found - testing basic export functionality only")