#!/usr/bin/env ruby
html = STDIN.read

html.gsub!(/<!-- #begin\(local\) -->[\s\S]*?<!-- #end\(local\) -->/, '')
html.gsub!(/<!-- #export (?<source>[\s\S]*?) -->/, '\k<source>')

puts html
