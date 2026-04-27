"""
Dead Code Sample File for Testing

This file contains various code patterns to test dead code detection functionality.
It includes:
- Unused imports and variables
- Empty functions and classes
- Unused parameters
- Dead code branches
- Unused methods
- Redundant code blocks

This sample is designed to be used with DeadCodeVisitor for testing purposes.
"""

# Unused imports
import os
import sys
import json
from typing import List, Dict, Optional
import pandas as pd
import numpy as np

# Unused variables
unused_variable = "This should be detected as dead code"
another_unused = 42
unused_dict = {"key": "value"}

# Used imports
import math
import datetime

# Used variables
used_variable = "This is used"
active_counter = 0

def used_function():
    """This function is used and should not be detected as dead code"""
    global active_counter
    active_counter += 1
    return active_counter

def unused_function():
    """This function is never called and should be detected as dead code"""
    return "dead code"

def function_with_unused_param(used_param, unused_param):
    """Function with one used and one unused parameter"""
    return used_param * 2

def empty_function():
    """Empty function that should be detected as dead code"""
    pass

def function_with_dead_branch(condition):
    """Function with a dead branch"""
    if condition:
        return "active"
    else:
        # This branch is never executed in normal usage
        return "dead code"

class UsedClass:
    """This class is used and should not be detected as dead code"""
    
    def __init__(self):
        self.active_value = "used"
    
    def used_method(self):
        """This method is called"""
        return self.active_value
    
    def unused_method(self):
        """This method is never called"""
        return "dead code"

class EmptyClass:
    """Empty class that should be detected as dead code"""
    pass

class ClassWithUnusedMethods:
    """Class with some used and some unused methods"""
    
    def used_method(self):
        """Used method"""
        return "used"
    
    def another_used_method(self):
        """Another used method"""
        return "also used"
    
    def unused_method_1(self):
        """Unused method"""
        return "dead"
    
    def unused_method_2(self):
        """Another unused method"""
        return "more dead"

# Dead code block - this entire block is unreachable
if False:
    dead_code_block = """
    This is a dead code block that should be detected.
    It contains multiple lines of dead code.
    """
    print(dead_code_block)

# Unused function definition
def another_unused_function():
    """Another unused function"""
    return "completely unused"

# Redundant code
redundant_code = "This is redundant"
another_redundant = "This is also redundant"

# Used code that should not be detected as dead
def main():
    """Main function that uses some of the code"""
    result = used_function()
    print(f"Result: {result}")
    
    obj = UsedClass()
    print(obj.used_method())
    
    condition = True
    print(function_with_dead_branch(condition))
    
    # Call function with unused parameter
    print(function_with_unused_param(5, 10))

if __name__ == "__main__":
    main()