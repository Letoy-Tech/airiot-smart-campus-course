package edu.campus.course;

import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Set;

/** Historical invented examples only, independent of the selected live provider. No write route. */
@RestController
@Profile("teacher-db")
public class CommandAuditController {
    private final MockCampusProvider samples;

    public CommandAuditController(MockCampusProvider samples) {
        this.samples = samples;
    }

    @GetMapping("/api/campus/command-audit")
    public ApiResponse<?> list(@RequestParam Map<String, String> parameters) {
        Access.admin();
        if (!Set.of("limit", "skip", "scenario").containsAll(parameters.keySet()))
            throw ApiFailure.bad();
        int limit = (int) Inputs.integer(parameters.getOrDefault("limit", "50"), 1, 100);
        int skip = (int) Inputs.integer(parameters.getOrDefault("skip", "0"), 0, 10000);
        return ApiResponse.ok(samples.commandAudit(
                limit, skip, parameters.getOrDefault("scenario", "normal")));
    }
}
