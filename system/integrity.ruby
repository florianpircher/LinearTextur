#!/usr/bin/env ruby
html = File.read('app.html')
File.write('index.html', html.gsub(/(<script\b[^>]+\bsrc|<link\b[^>]+\brel="stylesheet"[^>]+\bhref)="([^"]+)"/i) { |_|
  match = Regexp.last_match
  # TODO: check whether source file exits
  hash = `cat "#{match[2]}" | openssl dgst -sha384 -binary | openssl base64 -A`
  "#{match[1]}=\"#{match[2]}\" integrity=\"sha384-#{hash}\""
})
