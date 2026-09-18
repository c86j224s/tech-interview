cmake_minimum_required(VERSION 3.16)
project(recast_voxel_lifetime_harness LANGUAGES CXX)

set(RECAST_SOURCE_DIR "" CACHE PATH "Existing Recast Navigation v1.6.0 source tree")
if(NOT RECAST_SOURCE_DIR)
  message(FATAL_ERROR "Set RECAST_SOURCE_DIR to an existing Recast Navigation v1.6.0 source tree")
endif()
if(NOT EXISTS "${RECAST_SOURCE_DIR}/.git")
  message(FATAL_ERROR "RECAST_SOURCE_DIR must be a git checkout pinned to v1.6.0")
endif()
execute_process(
  COMMAND git -C "${RECAST_SOURCE_DIR}" rev-parse HEAD
  RESULT_VARIABLE RECAST_REV_RESULT
  OUTPUT_VARIABLE RECAST_HEAD
  OUTPUT_STRIP_TRAILING_WHITESPACE
  ERROR_QUIET)
if(NOT RECAST_REV_RESULT EQUAL 0 OR NOT RECAST_HEAD STREQUAL "6dc1667f580357e8a2154c28b7867bea7e8ad3a7")
  message(FATAL_ERROR "RECAST_SOURCE_DIR HEAD must be v1.6.0 commit 6dc1667f580357e8a2154c28b7867bea7e8ad3a7")
endif()
foreach(required_path
    Recast/CMakeLists.txt
    Detour/CMakeLists.txt
    DetourTileCache/CMakeLists.txt)
  if(NOT EXISTS "${RECAST_SOURCE_DIR}/${required_path}")
    message(FATAL_ERROR "Missing ${required_path}; RECAST_SOURCE_DIR must point to the v1.6.0 source tree")
  endif()
endforeach()

# The source tree is supplied by the caller and is never downloaded by this lab.
set(RECASTNAVIGATION_DEMO OFF CACHE BOOL "" FORCE)
set(RECASTNAVIGATION_TESTS OFF CACHE BOOL "" FORCE)
set(RECASTNAVIGATION_EXAMPLES OFF CACHE BOOL "" FORCE)
add_subdirectory("${RECAST_SOURCE_DIR}" recast-build EXCLUDE_FROM_ALL)

add_executable(recast_lifetime_harness main.cpp)
target_compile_features(recast_lifetime_harness PRIVATE cxx_std_11)
target_include_directories(recast_lifetime_harness PRIVATE
  "${RECAST_SOURCE_DIR}/Recast/Include"
  "${RECAST_SOURCE_DIR}/Detour/Include"
  "${RECAST_SOURCE_DIR}/DetourTileCache/Include")
target_link_libraries(recast_lifetime_harness PRIVATE
  RecastNavigation::Recast
  RecastNavigation::Detour
  RecastNavigation::DetourTileCache)

if(CMAKE_CXX_COMPILER_ID MATCHES "Clang|GNU")
  target_compile_options(recast_lifetime_harness PRIVATE -Wall -Wextra -Wpedantic -Wconversion)
endif()
